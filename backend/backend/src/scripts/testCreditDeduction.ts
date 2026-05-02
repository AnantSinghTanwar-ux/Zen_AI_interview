import 'dotenv/config';
import pool from '../config/database';
import { ApplicationService } from '../services/application.service';

async function runTests() {
  console.log('--- Starting Credit Deduction Integration Tests ---');
  let client;
  let recruiterId: string, applicantId: string, jobId: string, resumeId: string;

  try {
    client = await pool.connect();
    
    // 1. Setup mock data
    console.log('1. Setting up mock test data...');
    // Create recruiter
    const recRes = await client.query("INSERT INTO users (email, password_hash, role, referral_code) VALUES ('cred_rec@test.com', 'pwd', 'recruiter', 'REC123') RETURNING id");
    recruiterId = recRes.rows[0].id;
    await client.query("INSERT INTO recruiter_profiles (user_id, company_name, created_at, updated_at) VALUES ($1, 'Cred Test Inc', NOW(), NOW())", [recruiterId]);
    
    // Create applicant
    const appRes = await client.query("INSERT INTO users (email, password_hash, role, referral_code, credit_balance) VALUES ('cred_app@test.com', 'pwd', 'applicant', 'APP123', 1) RETURNING id");
    applicantId = appRes.rows[0].id;

    // Create applicant resume required for apply endpoint
    const resumeRes = await client.query(
      "INSERT INTO resumes (user_id, file_url, file_name, is_default) VALUES ($1, $2, $3, true) RETURNING id",
      [applicantId, 'https://example.com/mock-resume.pdf', 'mock-resume.pdf']
    );
    resumeId = resumeRes.rows[0].id;
    
    // Create job
    const jobRes = await client.query(
      "INSERT INTO jobs (recruiter_id, title, description, location, type, status) VALUES ($1, 'Senior Dev', 'Desc', 'Remote', 'full-time', 'active') RETURNING id", 
      [recruiterId]
    );
    jobId = jobRes.rows[0].id;

    console.log('2. Test 1: Successful Job Application (1 credit applied).');
    const applyRes1 = await ApplicationService.apply(applicantId, jobId, {
      cover_letter: 'Hello',
      resume_id: resumeId,
    });
    
    // Check ledger
    const ledger1 = await client.query("SELECT * FROM credit_transactions WHERE user_id = $1", [applicantId]);
    if (ledger1.rows.length !== 1 || ledger1.rows[0].amount !== -1 || ledger1.rows[0].reference_id !== jobId) {
       throw new Error('Ledger transaction 1 generated incorrectly.');
    }
    console.log('✅ Application 1 Successfully inserted ledger and returned creditsRemaining:', applyRes1.creditsRemaining);
    
    // Setup second job explicitly for out-of-funds run
    const jobRes2 = await client.query(
      "INSERT INTO jobs (recruiter_id, title, description, location, type, status) VALUES ($1, 'Junior Dev', 'Desc', 'Remote', 'full-time', 'active') RETURNING id", 
      [recruiterId]
    );
    const jobId2 = jobRes2.rows[0].id;

    console.log('3. Test 2: Out of Credits block limit.');
    let hit402 = false;
    try {
      await ApplicationService.apply(applicantId, jobId2, {
        cover_letter: 'I have 0 credits left',
        resume_id: resumeId,
      });
    } catch (err: any) {
      if (err.statusCode === 402) {
         hit402 = true;
         // Ensure available credits exposes cleanly
         if (err.availableCredits !== 0) throw new Error('Available credits should be 0');
      }
    }
    if (!hit402) throw new Error('Failed to block user with 402 when credits hit 0');
    console.log('✅ Correctly blocked application throwing PaymentRequired payload without locking db.');

    // Give applicant 10 credits to test concurrent race condition double spend limits
    await client.query("UPDATE users SET credit_balance = 10 WHERE id = $1", [applicantId]);
    
    // Attempt 5 concurrent applies to the exact SAME job (which violates Job duplication guard)
    const jobRes3 = await client.query(
      "INSERT INTO jobs (recruiter_id, title, description, location, type, status) VALUES ($1, 'Mid Dev', 'Desc', 'Remote', 'full-time', 'active') RETURNING id", 
      [recruiterId]
    );
    const jobId3 = jobRes3.rows[0].id;

    console.log('4. Test 3: Concurrency Race Condition Safety & Double Spend Prevent');
    let successfulApps = 0;
    let duplicateErrors = 0;

    const promises = Array.from({ length: 5 }).map(() => 
       ApplicationService.apply(applicantId, jobId3, { resume_id: resumeId })
        .then(() => successfulApps++)
        .catch(err => {
          if (err.statusCode === 409) duplicateErrors++;
          else throw err;
        })
    );
    
    await Promise.all(promises);

    const userCreditsAfterConcurrent = await client.query("SELECT credit_balance FROM users WHERE id = $1", [applicantId]);
    console.log(`Concurrent execution result: ${successfulApps} successes, ${duplicateErrors} blocked duplicates.`);
    
    if (successfulApps !== 1 || duplicateErrors !== 4) {
      throw new Error('Race condition guard failed. More than 1 app successful or invalid duplicates counts.');
    }
    if (userCreditsAfterConcurrent.rows[0].credit_balance !== 9) {
      throw new Error('Race condition allowed double spending / over deducting!');
    }
    console.log('✅ Safely defended against multiple rapid concurrent double-click attempts globally.');

    console.log('--- ALL CREDIT DEDUCTION TESTS PASSED ---');
  } catch (err) {
    console.error('❌ Integration Test Failed:', err);
  } finally {
    if (client) {
      console.log('Cleaning up mock data...');
      await client.query("DELETE FROM users WHERE email IN ('cred_rec@test.com', 'cred_app@test.com')");
      client.release();
    }
    pool.end();
  }
}

runTests();
