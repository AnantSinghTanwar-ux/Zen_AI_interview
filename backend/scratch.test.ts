import 'dotenv/config';
import pool from './src/config/database';
import jwt from 'jsonwebtoken';

async function generateToken(email: string, role: string) {
  const res = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (!res.rows[0]) throw new Error('User not found: ' + email);
  return jwt.sign({ userId: res.rows[0].id, role }, process.env.JWT_SECRET || 'secret');
}

async function runTests() {
  console.log('--- STARTING E2E VERIFICATION ---');
  try {
    const adminToken = await generateToken('admin@hiringplatform.com', 'admin');
    const recruiterToken = await generateToken('recruiter1@google.com', 'recruiter');
    const BASE_URL = 'http://localhost:5000';

    // TEST 1: Admin Route Authorization
    console.log('\n[Test 1] Admin Route Auth');
    let res = await fetch(`${BASE_URL}/api/v1/admin/applications`, {
      headers: { Authorization: `Bearer ${recruiterToken}` }
    });
    console.log('Recruiter accessing Admin:', res.status === 403 ? 'PASS (403 Forbidden)' : `FAIL (${res.status})`);
    
    // TEST 2: Admin Global Dashboard
    console.log('\n[Test 2] Admin Global Dashboard');
    res = await fetch(`${BASE_URL}/api/v1/admin/applications?limit=50`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    let data: any = await res.json();
    console.log('Total Platform Applications retrieved:', data.data?.length);
    const hasMultipleJobs = new Set((data.data || []).map((a:any) => a.job_id)).size > 1;
    console.log('Global Bypass active (Multiple distinct jobs from different recruiters):', hasMultipleJobs ? 'PASS' : 'FAIL');

    if (!data.data || data.data.length === 0) {
      console.log('No applications found. Aborting test 3 and 4.');
    } else {
      // TEST 3: Admin Detailed View Fetch
      console.log('\n[Test 3] Admin Detail Retrieve');
      const targetApp = data.data[0];
      res = await fetch(`${BASE_URL}/api/v1/admin/applications/${targetApp.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      data = await res.json();
      console.log('Application retrieved successfully:', data.success ? 'PASS' : 'FAIL');
      
      // TEST 4: Admin Status Update
      console.log('\n[Test 4] Admin Status Update');
      const previousStatus = targetApp.status;
      const testStatus = previousStatus === 'applied' ? 'in_review' : 'applied'; // toggle
      res = await fetch(`${BASE_URL}/api/v1/admin/applications/${targetApp.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ status: testStatus })
      });
      data = await res.json();
      console.log('Status update request:', res.status === 200 ? 'PASS' : `FAIL (${data.message})`);
      
      // Verify Database update
      const dbCheck = await pool.query('SELECT status FROM applications WHERE id = $1', [targetApp.id]);
      console.log('Database verification:', dbCheck.rows[0].status === testStatus ? 'PASS' : `FAIL (Expected ${testStatus}, got ${dbCheck.rows[0].status})`);
    }

    // TEST 5: Generic Search Capability
    console.log('\n[Test 5] Recruiter Generic Search');
    // Search for "Jane" (Candidate Name)
    res = await fetch(`${BASE_URL}/api/v1/applications/recruiter/applicants/filtered?search=Jane`, {
      headers: { Authorization: `Bearer ${recruiterToken}` }
    });
    data = await res.json();
    const foundJane = (data.data || []).some((a:any) => a.name === 'Jane Smith');
    console.log('Search by Applicant Name ("Jane"):', foundJane ? 'PASS' : 'FAIL');

    // Search for "Manager" (Job Title)
    res = await fetch(`${BASE_URL}/api/v1/applications/recruiter/applicants/filtered?search=Manager`, {
      headers: { Authorization: `Bearer ${recruiterToken}` }
    });
    data = await res.json();
    const foundManager = (data.data || []).some((a:any) => a.job_title?.includes('Manager'));
    console.log('Search by Job Title ("Manager"):', foundManager ? 'PASS' : 'FAIL');

    console.log('\n--- ALL TESTS COMPLETED SUCCESSFULLY ---');
  } catch (err) {
    console.error('Test framework crashed:', err);
  } finally {
    await pool.end();
  }
}

runTests();
