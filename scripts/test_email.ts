import { sendInterviewInviteEmail } from "../services/recruiter/email.service";

async function run() {
  console.log("Testing email...");
  const res = await sendInterviewInviteEmail({
    to: "test@example.com",
    candidateName: "Test Candidate",
    jobTitle: "Software Engineer",
    companyName: "ZenAI",
    interviewLink: "https://zen-ai.com/interview/test",
    deadline: "2026-08-05",
  });
  console.log("Email Result:", res);
}

run().catch(console.error);
