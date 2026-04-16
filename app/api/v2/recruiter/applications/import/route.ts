import { NextRequest, NextResponse } from "next/server";
import { recruiterGuard } from "@/app/api/v2/recruiter/_guard";
import { importApplications } from "@/services/recruiter/external-application.service";

export async function POST(request: NextRequest) {
  const { error } = await recruiterGuard();
  if (error) return error;

  try {
    const contentType = request.headers.get("content-type") || "";

    let records: any[] = [];

    if (contentType.includes("multipart/form-data")) {
      // CSV upload
      const formData = await request.formData();
      const file = formData.get("file") as File;
      if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });

      const text = await file.text();
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        return NextResponse.json({ error: "CSV must have header + data rows" }, { status: 400 });
      }

      const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const colMap: Record<string, number> = {};
      header.forEach((h, i) => { colMap[h] = i; });

      // Try to find columns by various header names
      const nameIdx = colMap["candidatename"] ?? colMap["name"] ?? colMap["candidate_name"] ?? colMap["candidate"] ?? -1;
      const emailIdx = colMap["candidateemail"] ?? colMap["email"] ?? colMap["candidate_email"] ?? -1;
      const resumeIdx = colMap["resumeurl"] ?? colMap["resume_url"] ?? colMap["resume"] ?? -1;
      const platformIdx = colMap["sourceplatform"] ?? colMap["source_platform"] ?? colMap["source"] ?? colMap["platform"] ?? -1;
      const companyIdx = colMap["companyname"] ?? colMap["company_name"] ?? colMap["company"] ?? -1;
      const titleIdx = colMap["roletitle"] ?? colMap["role_title"] ?? colMap["role"] ?? colMap["title"] ?? colMap["jobtitle"] ?? colMap["job_title"] ?? -1;
      const categoryIdx = colMap["rolecategory"] ?? colMap["role_category"] ?? colMap["category"] ?? -1;
      const jobIdIdx = colMap["externaljobid"] ?? colMap["external_job_id"] ?? colMap["jobid"] ?? colMap["job_id"] ?? -1;
      const jobUrlIdx = colMap["externaljoburl"] ?? colMap["external_job_url"] ?? colMap["joburl"] ?? colMap["job_url"] ?? -1;

      if (nameIdx === -1 || emailIdx === -1) {
        return NextResponse.json({ error: "CSV must have 'name'/'candidateName' and 'email'/'candidateEmail' columns" }, { status: 400 });
      }

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));

        records.push({
          candidateName: cols[nameIdx] || "",
          candidateEmail: cols[emailIdx] || "",
          resumeUrl: resumeIdx >= 0 ? cols[resumeIdx] : "",
          sourcePlatform: platformIdx >= 0 ? cols[platformIdx] : "other",
          companyName: companyIdx >= 0 ? cols[companyIdx] : "Unknown",
          roleTitle: titleIdx >= 0 ? cols[titleIdx] : "Software Engineer",
          roleCategory: categoryIdx >= 0 ? cols[categoryIdx] : "",
          externalJobId: jobIdIdx >= 0 ? cols[jobIdIdx] : "",
          externalJobUrl: jobUrlIdx >= 0 ? cols[jobUrlIdx] : "",
        });
      }
    } else {
      // JSON body
      const body = await request.json();
      records = Array.isArray(body) ? body : body.applications || body.records || [];
    }

    if (records.length === 0) {
      return NextResponse.json({ error: "No records found" }, { status: 400 });
    }

    const result = await importApplications(records);

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (err) {
    console.error("Import error:", err);
    return NextResponse.json({ error: "Import failed", details: (err as Error).message }, { status: 500 });
  }
}
