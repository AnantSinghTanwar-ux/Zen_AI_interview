import 'dotenv/config';
import pool from './database';
import bcrypt from 'bcrypt';
import { generateReferralCode } from '../utils/referralCode';

if (process.env.NODE_ENV === 'production') {
  console.error('Seed script must not run in production. Aborting.');
  process.exit(1);
}

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Starting seed...');

    // ── 1. Hash passwords ────────────────────────────────────────────────────────
    const adminHash = await bcrypt.hash('Admin@123456', 12);
    const recruiterHash = await bcrypt.hash('Recruiter@123', 12);
    const applicantHash = await bcrypt.hash('Applicant@123', 12);

    // ── 2. Insert admin ──────────────────────────────────────────────────────────
    console.log('Seeding admin...');
    await client.query(
      `
      INSERT INTO users (email, password_hash, role, is_verified, referral_code, credit_balance)
      VALUES ($1, $2, 'admin', TRUE, $3, 0)
      ON CONFLICT (email) DO NOTHING
    `,
      ['admin@hiringplatform.com', adminHash, generateReferralCode()],
    );

    // ── 3. Insert recruiters ─────────────────────────────────────────────────────
    console.log('Seeding recruiters...');
    const recruiters = [
      {
        email: 'recruiter1@google.com',
        company: 'Google',
        industry: 'Technology',
        name: 'Alice Chen',
        description:
          'Google is a global technology leader focused on improving the ways people connect with information.',
      },
      {
        email: 'recruiter2@microsoft.com',
        company: 'Microsoft',
        industry: 'Technology',
        name: 'Bob Williams',
        description:
          'Microsoft empowers every person and organization on the planet to achieve more through technology.',
      },
      {
        email: 'recruiter3@amazon.com',
        company: 'Amazon',
        industry: 'E-commerce',
        name: 'Carol Singh',
        description:
          'Amazon is guided by four principles: customer obsession, passion for invention, commitment to operational excellence, and long-term thinking.',
      },
    ];

    const recruiterIds: string[] = [];
    for (const r of recruiters) {
      const res = await client.query(
        `
        INSERT INTO users (email, password_hash, role, is_verified, referral_code, credit_balance)
        VALUES ($1, $2, 'recruiter', TRUE, $3, 50)
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      `,
        [r.email, recruiterHash, generateReferralCode()],
      );

      let userId: string;
      if (res.rowCount && res.rowCount > 0) {
        userId = res.rows[0].id;
      } else {
        // Already existed — fetch the id
        const existing = await client.query('SELECT id FROM users WHERE email = $1', [r.email]);
        userId = existing.rows[0].id;
      }
      recruiterIds.push(userId);

      // Recruiter profile
      await client.query(
        `
        INSERT INTO recruiter_profiles (user_id, name, company_name, industry, description, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (user_id) DO NOTHING
      `,
        [userId, r.name, r.company, r.industry, r.description],
      );

      // Credit transaction for seeded starting credits
      await client.query(
        `
        INSERT INTO credit_transactions (user_id, type, amount, balance_after, description)
        SELECT $1, 'credit', 50, 50, 'Seed: initial recruiter credits'
        WHERE NOT EXISTS (
          SELECT 1 FROM credit_transactions WHERE user_id = $1 AND description = 'Seed: initial recruiter credits'
        )
      `,
        [userId],
      );

      console.log(`  Recruiter seeded: ${r.email} (id: ${userId})`);
    }

    // ── 4. Insert applicants ─────────────────────────────────────────────────────
    console.log('Seeding applicants...');
    const applicants = [
      {
        email: 'john@example.com',
        name: 'John Doe',
        bio: 'Passionate full-stack developer with 3 years of experience building scalable web applications.',
        skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'PostgreSQL'],
      },
      {
        email: 'jane@example.com',
        name: 'Jane Smith',
        bio: 'Data scientist and ML engineer with expertise in Python, TensorFlow, and large-scale data pipelines.',
        skills: ['Python', 'Machine Learning', 'TensorFlow', 'Pandas', 'SQL'],
      },
    ];

    for (const a of applicants) {
      const res = await client.query(
        `
        INSERT INTO users (email, password_hash, role, is_verified, referral_code, credit_balance)
        VALUES ($1, $2, 'applicant', TRUE, $3, 50)
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      `,
        [a.email, applicantHash, generateReferralCode()],
      );

      let userId: string;
      if (res.rowCount && res.rowCount > 0) {
        userId = res.rows[0].id;
      } else {
        const existing = await client.query('SELECT id FROM users WHERE email = $1', [a.email]);
        userId = existing.rows[0].id;
      }

      await client.query(
        `
        INSERT INTO applicant_profiles (user_id, name, bio, skills)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id) DO NOTHING
      `,
        [userId, a.name, a.bio, a.skills],
      );

      console.log(`  Applicant seeded: ${a.email} (id: ${userId})`);
    }

    // ── 5. Insert 20 jobs ────────────────────────────────────────────────────────
    console.log('Seeding jobs...');

    // recruiterIds[0] = Google, recruiterIds[1] = Microsoft, recruiterIds[2] = Amazon
    const jobs = [
      // ── Google (recruiterIds[0]) ────────────────────────────────────────────────
      {
        recruiter_idx: 0,
        title: 'Senior Software Engineer',
        location: 'Mountain View, CA',
        type: 'full-time',
        salary_min: 180000,
        salary_max: 250000,
        skills: ['Go', 'Python', 'Kubernetes', 'Distributed Systems', 'SQL'],
        description:
          "Join Google's infrastructure team to build highly available, planet-scale distributed systems. You will design and implement core services used by billions of users worldwide. Strong proficiency in Go or Python and deep understanding of distributed systems are required. Experience with Kubernetes and large-scale data storage is a plus.",
      },
      {
        recruiter_idx: 0,
        title: 'ML Engineer',
        location: 'Remote',
        type: 'remote',
        salary_min: 160000,
        salary_max: 220000,
        skills: ['Python', 'TensorFlow', 'PyTorch', 'Machine Learning', 'NumPy', 'Pandas'],
        description:
          'We are looking for an ML Engineer to join Google Brain and work on cutting-edge machine learning research. You will collaborate with world-class researchers to develop novel deep learning models. Proficiency in Python and hands-on experience with TensorFlow or PyTorch are required. Strong mathematical foundations in linear algebra and statistics are expected.',
      },
      {
        recruiter_idx: 0,
        title: 'Product Manager — Search',
        location: 'New York, NY',
        type: 'full-time',
        salary_min: 150000,
        salary_max: 200000,
        skills: ['Product Strategy', 'Data Analysis', 'SQL', 'Roadmapping', 'A/B Testing'],
        description:
          'Drive the product roadmap for Google Search, one of the most used products on the planet. You will work cross-functionally with engineering, design, and marketing to define features that improve user experience. Strong analytical skills and the ability to translate data insights into actionable product decisions are essential. Prior experience in consumer internet products is highly desired.',
      },
      {
        recruiter_idx: 0,
        title: 'UX Designer',
        location: 'San Francisco, CA',
        type: 'full-time',
        salary_min: 130000,
        salary_max: 175000,
        skills: ['Figma', 'User Research', 'Prototyping', 'Design Systems', 'Accessibility'],
        description:
          "Design intuitive and delightful user experiences for Google's flagship products. You will conduct user research, create wireframes, and prototype end-to-end flows in collaboration with product and engineering teams. A strong portfolio demonstrating user-centered design process is required. Experience designing accessible interfaces at scale is a significant advantage.",
      },
      {
        recruiter_idx: 0,
        title: 'Android Developer',
        location: 'Remote',
        type: 'remote',
        salary_min: 140000,
        salary_max: 190000,
        skills: ['Kotlin', 'Android', 'Jetpack Compose', 'REST', 'Git'],
        description:
          "Build next-generation Android experiences for Google's suite of consumer applications. You will architect and develop features used by hundreds of millions of Android users globally. Deep expertise in Kotlin and Android Jetpack components is required. Experience with Jetpack Compose and performance optimization is strongly preferred.",
      },
      // ── Microsoft (recruiterIds[1]) ─────────────────────────────────────────────
      {
        recruiter_idx: 1,
        title: 'Backend Developer',
        location: 'Redmond, WA',
        type: 'full-time',
        salary_min: 155000,
        salary_max: 210000,
        skills: ['C#', '.NET', 'Azure', 'SQL', 'REST', 'Docker'],
        description:
          "Join Microsoft Azure's backend engineering team to build cloud-native services that power enterprise workloads worldwide. You will design RESTful APIs, implement microservices, and contribute to our CI/CD pipelines. Proficiency in C# and .NET with solid Azure experience is required. Familiarity with Kubernetes and distributed systems patterns is a strong plus.",
      },
      {
        recruiter_idx: 1,
        title: 'Full Stack Developer',
        location: 'Remote',
        type: 'remote',
        salary_min: 140000,
        salary_max: 195000,
        skills: ['TypeScript', 'React', 'Node.js', 'Azure', 'PostgreSQL', 'Docker'],
        description:
          "Work on Microsoft Teams' web platform, building features that empower hybrid collaboration for enterprises. You will own full-stack features from design through production deployment. Strong proficiency in TypeScript, React, and Node.js is expected. Experience with Azure cloud services and DevOps workflows is highly valued.",
      },
      {
        recruiter_idx: 1,
        title: 'DevOps Engineer',
        location: 'Austin, TX',
        type: 'full-time',
        salary_min: 135000,
        salary_max: 180000,
        skills: ['Azure', 'Kubernetes', 'Docker', 'Terraform', 'CI/CD', 'Git'],
        description:
          "Own and evolve Microsoft's internal developer platform powering thousands of engineering teams. You will design infrastructure-as-code solutions, manage Kubernetes clusters, and improve deployment reliability. Expertise in Azure and Terraform along with strong Kubernetes operational skills are required. A passion for developer productivity and a track record of reducing incident rates are expected.",
      },
      {
        recruiter_idx: 1,
        title: 'Data Scientist',
        location: 'Seattle, WA',
        type: 'full-time',
        salary_min: 145000,
        salary_max: 200000,
        skills: ['Python', 'Machine Learning', 'SQL', 'Azure', 'Pandas', 'Spark'],
        description:
          "Apply machine learning to improve Microsoft's advertising relevance and recommendation systems. You will develop predictive models, run experiments, and present findings to senior leadership. A strong background in statistics, ML, and Python is required. Experience with big data platforms such as Spark and Azure ML is a strong advantage.",
      },
      {
        recruiter_idx: 1,
        title: 'iOS Developer',
        location: 'Remote',
        type: 'contract',
        salary_min: 120000,
        salary_max: 165000,
        skills: ['Swift', 'iOS', 'SwiftUI', 'REST', 'Git', 'Xcode'],
        description:
          'Build compelling iOS experiences for the Microsoft 365 mobile app suite used by millions of professionals. You will collaborate with design and backend teams to ship high-quality, performant features on iOS. Proficiency in Swift and SwiftUI with a strong understanding of iOS lifecycle and performance best practices is required. Experience with Microsoft Graph API integration is a plus.',
      },
      // ── Amazon (recruiterIds[2]) ────────────────────────────────────────────────
      {
        recruiter_idx: 2,
        title: 'Software Development Engineer',
        location: 'Seattle, WA',
        type: 'full-time',
        salary_min: 160000,
        salary_max: 230000,
        skills: ['Java', 'AWS', 'Distributed Systems', 'SQL', 'Docker', 'Microservices'],
        description:
          "Join Amazon's e-commerce platform team to design and build services at massive scale. You will own end-to-end feature development — from system design to production — for systems processing millions of transactions daily. Strong Java skills with solid experience in AWS and distributed architectures are required. Proven ability to mentor junior engineers and drive technical decisions is expected.",
      },
      {
        recruiter_idx: 2,
        title: 'Frontend Developer',
        location: 'New York, NY',
        type: 'full-time',
        salary_min: 130000,
        salary_max: 175000,
        skills: ['JavaScript', 'TypeScript', 'React', 'CSS', 'HTML', 'Performance Optimization'],
        description:
          'Craft fast, accessible, and beautiful shopping experiences on Amazon.com visited by hundreds of millions of customers. You will develop reusable UI components, optimize web vitals, and collaborate closely with UX designers. Expertise in React and TypeScript with a strong focus on performance and accessibility is required. Experience with A/B experimentation platforms is a plus.',
      },
      {
        recruiter_idx: 2,
        title: 'QA Engineer',
        location: 'Remote',
        type: 'remote',
        salary_min: 110000,
        salary_max: 150000,
        skills: ['Test Automation', 'Selenium', 'Python', 'CI/CD', 'REST', 'SQL'],
        description:
          "Ensure the quality and reliability of Amazon's customer-facing checkout and payments systems. You will design automated test frameworks, integrate them into CI/CD pipelines, and own QA strategy for multiple squads. Strong experience in test automation with Python and Selenium is required. A security-conscious mindset and experience testing RESTful APIs are highly valued.",
      },
      {
        recruiter_idx: 2,
        title: 'Cloud Infrastructure Engineer',
        location: 'Arlington, VA',
        type: 'full-time',
        salary_min: 150000,
        salary_max: 205000,
        skills: ['AWS', 'Terraform', 'Kubernetes', 'Python', 'CI/CD', 'Networking'],
        description:
          "Design and operate AWS infrastructure supporting Amazon's logistics and fulfillment services globally. You will drive infrastructure-as-code adoption, manage large Kubernetes fleets, and reduce operational toil. Expert-level AWS knowledge and strong Terraform skills are mandatory. Experience with large-scale networking, VPCs, and hybrid cloud connectivity is strongly preferred.",
      },
      {
        recruiter_idx: 2,
        title: 'Data Engineer',
        location: 'Remote',
        type: 'remote',
        salary_min: 135000,
        salary_max: 185000,
        skills: ['Python', 'Spark', 'AWS', 'SQL', 'Airflow', 'Redshift'],
        description:
          "Build robust, scalable data pipelines that feed Amazon's analytics and ML platforms. You will design ETL workflows, manage data quality, and collaborate with data scientists to productionize models. Proficiency in Python, Spark, and SQL with deep AWS data services experience is required. Familiarity with Airflow-based orchestration and data governance practices is a plus.",
      },
      {
        recruiter_idx: 2,
        title: 'Product Manager — Prime',
        location: 'Seattle, WA',
        type: 'full-time',
        salary_min: 145000,
        salary_max: 195000,
        skills: ['Product Strategy', 'Data Analysis', 'SQL', 'Customer Obsession', 'Roadmapping'],
        description:
          "Define and execute the product strategy for Amazon Prime's benefits and subscription experience. You will synthesize customer feedback, usage data, and market trends to build a compelling product roadmap. Strong analytical skills, SQL proficiency, and experience owning end-to-end consumer product features are required. Demonstrated ability to influence without authority in a fast-paced, cross-functional environment is essential.",
      },
      // ── Additional mixed jobs ───────────────────────────────────────────────────
      {
        recruiter_idx: 0,
        title: 'Site Reliability Engineer',
        location: 'Chicago, IL',
        type: 'full-time',
        salary_min: 155000,
        salary_max: 215000,
        skills: ['Go', 'Kubernetes', 'Prometheus', 'GCP', 'Python', 'Incident Management'],
        description:
          "Improve reliability, scalability, and performance across Google's production systems. You will be on-call for critical services, drive post-mortems, and build tooling that reduces toil. Expertise in Go or Python, Kubernetes, and observability stacks such as Prometheus and Grafana is required. A track record of improving system SLOs and reducing mean time to recovery is expected.",
      },
      {
        recruiter_idx: 1,
        title: 'Security Engineer',
        location: 'Austin, TX',
        type: 'full-time',
        salary_min: 150000,
        salary_max: 205000,
        skills: ['Cloud Security', 'Azure', 'Python', 'Penetration Testing', 'IAM', 'Zero Trust'],
        description:
          "Protect Microsoft's cloud products and customer data by designing and implementing security controls. You will conduct threat modelling, perform penetration testing, and champion security best practices across engineering teams. Deep expertise in cloud security with Azure and identity management is required. Industry certifications such as CISSP or OSCP are a significant plus.",
      },
      {
        recruiter_idx: 2,
        title: 'Robotics Software Engineer',
        location: 'Boston, MA',
        type: 'full-time',
        salary_min: 165000,
        salary_max: 225000,
        skills: ['C++', 'Python', 'ROS', 'Machine Learning', 'Computer Vision', 'AWS'],
        description:
          "Develop software for Amazon Robotics' warehouse automation systems that pick, pack, and ship millions of packages daily. You will implement real-time motion planning and perception algorithms for autonomous robots. Strong C++ and Python skills with hands-on experience in ROS and computer vision are required. Experience with ML-based perception and real-time systems is highly valued.",
      },
      {
        recruiter_idx: 1,
        title: 'Technical Program Manager',
        location: 'Remote',
        type: 'remote',
        salary_min: 140000,
        salary_max: 190000,
        skills: [
          'Program Management',
          'Agile',
          'Risk Management',
          'Stakeholder Communication',
          'Azure',
          'SQL',
        ],
        description:
          "Lead complex, cross-team engineering programs within Microsoft's Azure organization from planning through delivery. You will drive alignment between engineering, product, and business stakeholders, manage risks, and report program health to senior leadership. Proven experience managing large-scale technical programs with distributed teams is required. PMP or equivalent certification and strong SQL-based reporting skills are a plus.",
      },
    ];

    for (const job of jobs) {
      const recruiterId = recruiterIds[job.recruiter_idx];
      await client.query(
        `
        INSERT INTO jobs (recruiter_id, title, location, salary_min, salary_max, type, skills, description, status, is_boosted, views_count)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', FALSE, 0)
      `,
        [
          recruiterId,
          job.title,
          job.location,
          job.salary_min,
          job.salary_max,
          job.type,
          job.skills,
          job.description,
        ],
      );
      console.log(`  Job seeded: "${job.title}" at recruiter index ${job.recruiter_idx}`);
    }

    // ── 6. Insert sample applications ───────────────────────────────────────────
    console.log('Seeding sample applications...');

    // Get all job IDs
    const jobsRes = await client.query('SELECT id FROM jobs ORDER BY created_at ASC');
    const jobIds = jobsRes.rows.map((r) => r.id);

    // First applicant applies to some jobs
    const johnId = (
      await client.query('SELECT id FROM users WHERE email = $1', ['john@example.com'])
    ).rows[0].id;
    const janeId = (
      await client.query('SELECT id FROM users WHERE email = $1', ['jane@example.com'])
    ).rows[0].id;

    const applications = [
      // John's applications
      { job_idx: 0, applicant_id: johnId, status: 'shortlisted' }, // Google - Senior SWE
      { job_idx: 1, applicant_id: johnId, status: 'interview' }, // Google - ML Engineer
      { job_idx: 5, applicant_id: johnId, status: 'applied' }, // Microsoft - Backend
      { job_idx: 6, applicant_id: johnId, status: 'in_review' }, // Microsoft - Full Stack
      { job_idx: 10, applicant_id: johnId, status: 'offer' }, // Amazon - SDE
      // Jane's applications
      { job_idx: 1, applicant_id: janeId, status: 'shortlisted' }, // Google - ML Engineer
      { job_idx: 8, applicant_id: janeId, status: 'applied' }, // Microsoft - Data Scientist
      { job_idx: 14, applicant_id: janeId, status: 'in_review' }, // Amazon - Data Engineer
      { job_idx: 2, applicant_id: janeId, status: 'rejected' }, // Google - PM Search
    ];

    for (const app of applications) {
      const appRes = await client.query(
        `
        INSERT INTO applications (job_id, applicant_id, cover_letter, status, status_updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (job_id, applicant_id) 
        DO UPDATE SET status = EXCLUDED.status, status_updated_at = NOW()
        RETURNING id
      `,
        [
          jobIds[app.job_idx],
          app.applicant_id,
          `I am very interested in this position and believe my skills are a great match.`,
          app.status,
        ],
      );

      if (appRes.rowCount && appRes.rowCount > 0 && appRes.rows[0].id) {
        // Pipeline events table not yet implemented
        // await client.query(
        //   `INSERT INTO pipeline_events (application_id, new_status, changed_by_id)
        //    VALUES ($1, $2, $3)`,
        //   [appRes.rows[0].id, app.status, app.applicant_id],
        // );
      }
      console.log(`  Application seeded for applicant (status: ${app.status})`);
    }

    console.log(`\nSeed complete. Summary:`);
    console.log(`  1 admin, 3 recruiters (500 credits each), 2 applicants, ${jobs.length} jobs, 9 applications`);
  } catch (err) {
    console.error('Seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
    console.log('DB pool closed.');
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
