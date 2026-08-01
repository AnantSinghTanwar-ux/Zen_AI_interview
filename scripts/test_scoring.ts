import { config } from "dotenv";
config({ path: ".env" });

import { RecruitmentJob } from "../types/recruiter";
import { hasOpenRouterKey } from "../services/ai/openrouter-client";

async function run() {
  console.log("Has key?", hasOpenRouterKey());
  const job = {
    title: "Software Engineer",
    description: "Build cool stuff.",
    requiredSkills: ["React", "Node.js"],
    experienceLevel: "mid",
    type: "technical",
  } as RecruitmentJob;
  
  const candidate = {
    id: "test1",
    resumeText: "Experienced Software Engineer with React and Node.js skills.",
  };
  
  const { batchScoreCandidates } = await import("../services/recruiter/batch-scoring.service");
  
  const res = await batchScoreCandidates([candidate], job, 1);
  console.log(JSON.stringify(res, null, 2));
}

run().catch(console.error);
