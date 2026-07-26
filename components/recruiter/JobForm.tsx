"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Briefcase, Plus, X, Sparkles } from "lucide-react";

const SKILLS_LIST = [
  "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Python",
  "Java", "Go", "Rust", "C++", "PostgreSQL", "MongoDB", "Redis",
  "AWS", "GCP", "Azure", "Docker", "Kubernetes", "GraphQL", "REST APIs",
  "System Design", "Machine Learning", "Data Structures", "SQL",
];

interface JobFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function JobForm({ onSuccess, onCancel }: JobFormProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    requiredSkills: [] as string[],
    experienceLevel: "mid" as "junior" | "mid" | "senior" | "lead",
    type: "mixed" as "technical" | "behavioral" | "mixed",
  });
  const [customSkill, setCustomSkill] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleSkill = (skill: string) => {
    setFormData((prev) => ({
      ...prev,
      requiredSkills: prev.requiredSkills.includes(skill)
        ? prev.requiredSkills.filter((s) => s !== skill)
        : [...prev.requiredSkills, skill],
    }));
  };

  const addCustomSkill = () => {
    if (customSkill.trim() && !formData.requiredSkills.includes(customSkill.trim())) {
      setFormData((prev) => ({
        ...prev,
        requiredSkills: [...prev.requiredSkills, customSkill.trim()],
      }));
      setCustomSkill("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error("Job title is required");
      return;
    }
    if (!formData.description.trim()) {
      toast.error("Job description is required");
      return;
    }
    if (formData.requiredSkills.length === 0) {
      toast.error("Select at least one required skill");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/v2/recruiter/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success("Job created successfully!");
        setFormData({
          title: "",
          description: "",
          requiredSkills: [],
          experienceLevel: "mid",
          type: "mixed",
        });
        if (onSuccess) {
          onSuccess();
        } else {
          window.location.href = "/recruiter";
        }
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to create job");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Job Title *
        </label>
        <input
          type="text"
          placeholder="e.g. Senior Backend Engineer"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Job Description *
        </label>
        <textarea
          placeholder="Describe the role, responsibilities, and expectations..."
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={4}
          className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all resize-none"
        />
      </div>

      {/* Experience Level & Interview Type */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Experience Level
          </label>
          <select
            value={formData.experienceLevel}
            onChange={(e) => setFormData({ ...formData, experienceLevel: e.target.value as any })}
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary/50 transition-all appearance-none"
          >
            <option value="junior">Junior (0-2 yrs)</option>
            <option value="mid">Mid-Level (2-5 yrs)</option>
            <option value="senior">Senior (5+ yrs)</option>
            <option value="lead">Lead / Principal</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Interview Type
          </label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary/50 transition-all appearance-none"
          >
            <option value="mixed">Mixed</option>
            <option value="technical">Technical</option>
            <option value="behavioral">Behavioral</option>
          </select>
        </div>
      </div>

      {/* Required Skills */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Required Skills *
        </label>
        <div className="flex flex-wrap gap-2 mb-3">
          {SKILLS_LIST.map((skill) => (
            <button
              key={skill}
              type="button"
              onClick={() => toggleSkill(skill)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all duration-200 ${
                formData.requiredSkills.includes(skill)
                  ? "bg-primary/20 text-primary border-primary/30"
                  : "bg-white/[0.03] text-muted-foreground border-white/10 hover:border-white/20"
              }`}
            >
              {skill}
            </button>
          ))}
        </div>

        {/* Custom skill input */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add custom skill..."
            value={customSkill}
            onChange={(e) => setCustomSkill(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomSkill(); } }}
            className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-all"
          />
          <button
            type="button"
            onClick={addCustomSkill}
            className="bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground hover:border-white/20 transition-all"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Selected skills */}
        {formData.requiredSkills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {formData.requiredSkills.map((skill) => (
              <span
                key={skill}
                className="flex items-center gap-1 text-xs bg-primary/15 text-primary px-2.5 py-1 rounded-full"
              >
                {skill}
                <button type="button" onClick={() => toggleSkill(skill)}>
                  <X className="w-3 h-3 opacity-60 hover:opacity-100" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-muted-foreground hover:text-foreground px-5 py-2.5 rounded-full border border-white/10 hover:border-white/20 transition-all"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium px-6 py-2.5 rounded-full transition-all disabled:opacity-50"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Creating…
            </>
          ) : (
            <>
              <Briefcase className="w-4 h-4" />
              Create Job
            </>
          )}
        </button>
      </div>
    </form>
  );
}
