"use client";

import { useState, useRef } from "react";
import { Upload, FileText, Settings, Loader2, Sparkles, Check, Type } from "lucide-react";
import { toast } from "sonner";

export interface JobConfig {
  title: string;
  description: string;
  requiredSkills: string; // comma separated
  experienceLevel: string; // junior, mid, senior, lead
}

interface JDConfigFormProps {
  onJobConfigured: (config: JobConfig) => void;
  onCancel?: () => void;
}

export default function JDConfigForm({ onJobConfigured, onCancel }: JDConfigFormProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "manual">("upload");
  const [isParsing, setIsParsing] = useState(false);
  const [config, setConfig] = useState<JobConfig>({
    title: "",
    description: "",
    requiredSkills: "",
    experienceLevel: "mid",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/v2/recruiter/parse-jd", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to parse JD");
      }

      const parsed = await res.json();
      setConfig({
        title: parsed.title || "",
        description: parsed.description || "",
        requiredSkills: (parsed.requiredSkills || []).join(", "),
        experienceLevel: ["junior", "mid", "senior", "lead"].includes(parsed.experienceLevel?.toLowerCase()) 
          ? parsed.experienceLevel.toLowerCase() 
          : "mid",
      });
      
      toast.success("Job Description successfully parsed!");
      setActiveTab("manual"); // Switch to manual to review
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error parsing JD");
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!config.title.trim() || !config.description.trim() || !config.requiredSkills.trim()) {
      toast.error("Please fill out the title, description, and skills.");
      return;
    }
    onJobConfigured(config);
  };

  return (
    <div className="bg-card/60 backdrop-blur-sm border border-white/[0.06] rounded-2xl overflow-hidden">
      <div className="flex border-b border-white/[0.06]">
        <button
          onClick={() => setActiveTab("upload")}
          className={`flex-1 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === "upload" 
              ? "bg-primary/10 text-primary border-b-2 border-primary" 
              : "text-muted-foreground hover:text-foreground hover:bg-white/[0.02]"
          }`}
        >
          <Upload className="w-4 h-4" />
          Upload JD (Auto-Extract)
        </button>
        <button
          onClick={() => setActiveTab("manual")}
          className={`flex-1 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === "manual" 
              ? "bg-primary/10 text-primary border-b-2 border-primary" 
              : "text-muted-foreground hover:text-foreground hover:bg-white/[0.02]"
          }`}
        >
          <Type className="w-4 h-4" />
          Manual Entry
        </button>
      </div>

      <div className="p-6">
        {activeTab === "upload" ? (
          <div className="text-center py-12 px-4 border-2 border-dashed border-white/[0.1] rounded-xl bg-black/20 relative group">
            {isParsing ? (
              <div className="flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  AI is reading the JD...
                </p>
              </div>
            ) : (
              <>
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4 group-hover:text-primary transition-colors" />
                <h3 className="text-lg font-semibold text-foreground mb-2">Upload Job Description</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                  Upload an image (PNG, JPG) or PDF of the Job Description. Our AI will automatically extract the title, skills, and experience required.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="jd-upload"
                />
                <label
                  htmlFor="jd-upload"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium cursor-pointer hover:opacity-90 transition-opacity"
                >
                  <Upload className="w-4 h-4" />
                  Select File
                </label>
              </>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Job Title</label>
                <input
                  type="text"
                  required
                  value={config.title}
                  onChange={(e) => setConfig({ ...config, title: e.target.value })}
                  placeholder="e.g. Senior Frontend Engineer"
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Experience Level</label>
                <select
                  value={config.experienceLevel}
                  onChange={(e) => setConfig({ ...config, experienceLevel: e.target.value })}
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none"
                >
                  <option value="junior">Junior (0-2 years)</option>
                  <option value="mid">Mid-Level (3-5 years)</option>
                  <option value="senior">Senior (5-8 years)</option>
                  <option value="lead">Lead/Principal (8+ years)</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Required Skills (Comma separated)</label>
              <input
                type="text"
                required
                value={config.requiredSkills}
                onChange={(e) => setConfig({ ...config, requiredSkills: e.target.value })}
                placeholder="e.g. React, TypeScript, Node.js, AWS"
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Full Description / Context</label>
              <textarea
                required
                value={config.description}
                onChange={(e) => setConfig({ ...config, description: e.target.value })}
                placeholder="Paste or type the full job description here to give the AI context for screening..."
                className="w-full h-32 px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                className="flex-1 bg-primary text-primary-foreground py-3 rounded-xl font-bold flex justify-center items-center gap-2 hover:opacity-90 transition-opacity"
              >
                <Settings className="w-5 h-5" />
                Configure Engine & Start Screening
              </button>
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-6 py-3 border border-white/10 bg-white/5 rounded-xl text-foreground hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
