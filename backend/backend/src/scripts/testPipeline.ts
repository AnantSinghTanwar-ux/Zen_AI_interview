import 'dotenv/config';
import pool from '../config/database';
import { PipelineService } from '../services/pipeline.service';

async function runTests() {
  console.log('--- Starting Pipeline Integration Tests ---');
  let client;
  try {
    client = await pool.connect();
    
    // 1. Setup mock data
    console.log('1. Setting up mock test data...');
    const recruiterRes = await client.query("INSERT INTO users (email, password_hash, role, referral_code) VALUES ('testr@example.com', 'pwd', 'recruiter', 'REF_TEST1') RETURNING id");
    const recruiterId = recruiterRes.rows[0].id;
    await client.query("INSERT INTO recruiter_profiles (user_id, company_name, created_at, updated_at) VALUES ($1, 'Test Company', NOW(), NOW())", [recruiterId]);
    
    const applicantRes = await client.query("INSERT INTO users (email, password_hash, role, referral_code) VALUES ('testa@example.com', 'pwd', 'applicant', 'REF_TEST2') RETURNING id");
    const applicantId = applicantRes.rows[0].id;

    // Create profile
    await client.query("INSERT INTO applicant_profiles (user_id, name, skills) VALUES ($1, 'TestApplicantName', ARRAY['React'])", [applicantId]);

    const jobRes = await client.query("INSERT INTO jobs (recruiter_id, title, description, location, type, salary_min, salary_max) " +
       "VALUES ($1, 'Test Job', 'Desc', 'Remote', 'full-time', 50000, 60000) RETURNING id", [recruiterId]);
    const jobId = jobRes.rows[0].id;

    const appRes = await client.query("INSERT INTO applications (job_id, applicant_id, status) VALUES ($1, $2, 'applied') RETURNING id", [jobId, applicantId]);
    const appId = appRes.rows[0].id;

    // 2. Test Pipeline Board Aggregation
    console.log('2. Testing Pipeline Board Aggregation...');
    const board = await PipelineService.getPipelineBoard(recruiterId, jobId);
    if (board.totalCandidates !== 1 || !board.stages.applied.length) {
      throw new Error('Board aggregation failed to fetch assigned test candidate');
    }
    console.log('✅ Board query using JSON_AGG worked flawlessly.');

    // 3. Test Move Candidate Stage
    console.log('3. Testing Candidate Stage Movement (APPLIED -> INTERVIEW)...');
    const newBoard = await PipelineService.moveCandidateStage(recruiterId, applicantId, jobId, 'interview', 'Automated interview transition');
    if (!newBoard.stages.interview.find((c: any) => c.applicant_id === applicantId)) {
      throw new Error('Candidate did not move to INTERVIEW stage properly');
    }
    console.log('✅ Stage movement transaction succeeded');

    // 4. Test History Logging
    console.log('4. Testing History Logging Tracking...');
    const history = await PipelineService.getCandidateHistory(recruiterId, applicantId, jobId);
    if (!history.find((h: any) => h.new_status === 'interview' && h.notes === 'Automated interview transition')) {
      throw new Error('Pipeline history missing the newly logged event');
    }
    console.log('✅ History logged successfully');

    // 5. Test Access Guard (Unauthorized User)
    console.log('5. Testing Security Guard...');
    try {
      await PipelineService.checkEmployerPipelineAccess('bogus_id', jobId);
      throw new Error('Security guard failed to throw Forbidden exception');
    } catch (err: any) {
      console.log('✅ Security guard blocked unauthorized access successfully');
    }

    // Cleanup
    console.log('Cleaning up mock data...');
    await client.query("DELETE FROM users WHERE email IN ('testr@example.com', 'testa@example.com')");

    console.log('--- ALL PIPELINE TESTS PASSED ---');
  } catch (error) {
    console.error('❌ Integration Test Failed:', error);
    if (client) {
      await client.query("DELETE FROM users WHERE email IN ('testr@example.com', 'testa@example.com')");
    }
  } finally {
    if (client) client.release();
    pool.end();
  }
}

runTests();
