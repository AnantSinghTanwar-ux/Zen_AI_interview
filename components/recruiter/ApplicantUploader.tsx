"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Upload, FileText, AlertCircle, CheckCircle2 } from "lucide-react";

interface ApplicantUploaderProps {
  jobId: string;
  onSuccess?: () => void;
}

interface ParsedApplicant {
  name: string;
  email: string;
  resumeUrl?: string;
}

export default function ApplicantUploader({ jobId, onSuccess }: ApplicantUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedApplicant[]>([]);
  const [totalParsed, setTotalParsed] = useState(0);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const parseCSV = async (selectedFile: File) => {
    const text = await selectedFile.text();
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

    if (lines.length < 2) {
      toast.error("CSV must have a header and at least one data row");
      return;
    }

    const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
    const nameIdx = header.findIndex((h) => h.includes("name"));
    const emailIdx = header.findIndex((h) => h.includes("email"));
    const resumeIdx = header.findIndex((h) => h.includes("resume"));

    if (nameIdx === -1 || emailIdx === -1) {
      toast.error("CSV must contain 'name' and 'email' columns");
      return;
    }

    const parsed: ParsedApplicant[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim());
      const name = cols[nameIdx];
      const email = cols[emailIdx];
      const resumeUrl = resumeIdx >= 0 ? cols[resumeIdx] : undefined;

      if (name && email && email.includes("@")) {
        parsed.push({ name, email, resumeUrl });
      }
    }

    setFile(selectedFile);
    setTotalParsed(parsed.length);
    setPreview(parsed.slice(0, 5));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) parseCSV(selected);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && dropped.name.endsWith(".csv")) {
      parseCSV(dropped);
    } else {
      toast.error("Please drop a .csv file");
    }
  };

  const handleImport = async () => {
    if (!file || !jobId) return;
    setImporting(true);

    try {
      const formData = new FormData();
      formData.append("jobId", jobId);
      formData.append("file", file);

      const res = await fetch("/api/v2/recruiter/applicants/import", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (res.ok) {
        toast.success(
          `Imported ${result.imported} applicants${result.duplicates ? ` (${result.duplicates} duplicates skipped)` : ""}`
        );
        setFile(null);
        setPreview([]);
        setTotalParsed(0);
        onSuccess?.();
      } else {
        toast.error(result.error || "Import failed");
      }
    } catch {
      toast.error("Failed to import applicants");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer ${
          dragActive
            ? "border-primary bg-primary/10 scale-[1.01]"
            : "border-white/10 hover:border-primary/40 hover:bg-white/[0.02]"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById("csv-upload")?.click()}
      >
        <input
          id="csv-upload"
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
        />
        <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
        <p className="text-foreground font-medium">
          {file ? file.name : "Drop CSV here or click to browse"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Required columns: name, email · Optional: resumeUrl
        </p>
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-card/60 backdrop-blur-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">
                Preview — {totalParsed} applicant{totalParsed !== 1 ? "s" : ""} found
              </span>
            </div>
            {totalParsed > 5 && (
              <span className="text-xs text-muted-foreground">
                Showing first 5
              </span>
            )}
          </div>

          <div className="divide-y divide-white/5">
            {preview.map((app, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                  {app.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {app.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {app.email}
                  </p>
                </div>
                {app.resumeUrl && (
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    Resume
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="px-5 py-4 border-t border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertCircle className="w-3.5 h-3.5" />
              Duplicates will be skipped automatically
            </div>
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium px-5 py-2 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Import All ({totalParsed})
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
