"use client";

import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  X,
  CheckCircle2,
  AlertTriangle,
  File,
  Loader2,
} from "lucide-react";

interface BulkResumeUploaderProps {
  jobId: string;
  topN: number;
  onUploadComplete: (bulkJobId: string) => void;
  disabled?: boolean;
}

interface UploadedFile {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".doc", ".txt"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const CHUNK_SIZE = 50; // Files per upload chunk

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(name: string): string {
  return `.${name.split(".").pop()?.toLowerCase() || ""}`;
}

export default function BulkResumeUploader({
  jobId,
  topN,
  onUploadComplete,
  disabled = false,
}: BulkResumeUploaderProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalSize = files.reduce((sum, f) => sum + f.file.size, 0);
  const validCount = files.filter(
    (f) =>
      ACCEPTED_EXTENSIONS.includes(getFileExtension(f.file.name)) &&
      f.file.size <= MAX_FILE_SIZE &&
      f.file.size > 0
  ).length;

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const additions: UploadedFile[] = [];
    for (const file of Array.from(newFiles)) {
      const ext = getFileExtension(file.name);
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        toast.error(`Skipped ${file.name}: unsupported type`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`Skipped ${file.name}: exceeds 10MB`);
        continue;
      }
      if (file.size === 0) {
        toast.error(`Skipped ${file.name}: empty file`);
        continue;
      }
      additions.push({ file, status: "pending" });
    }
    setFiles((prev) => [...prev, ...additions]);
    if (additions.length > 0) {
      toast.success(`Added ${additions.length} resume(s)`);
    }
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearAll = useCallback(() => {
    setFiles([]);
    setUploadProgress(0);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleUpload = useCallback(async () => {
    if (files.length === 0 || uploading || disabled) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      // Upload in chunks
      const validFiles = files.filter(
        (f) =>
          ACCEPTED_EXTENSIONS.includes(getFileExtension(f.file.name)) &&
          f.file.size <= MAX_FILE_SIZE &&
          f.file.size > 0
      );

      const totalChunks = Math.ceil(validFiles.length / CHUNK_SIZE);
      let totalUploaded = 0;
      let bulkJobId = "";

      for (let chunk = 0; chunk < totalChunks; chunk++) {
        const chunkFiles = validFiles.slice(
          chunk * CHUNK_SIZE,
          (chunk + 1) * CHUNK_SIZE
        );

        const formData = new FormData();
        formData.append("jobId", jobId);
        formData.append("topN", String(topN));

        for (const { file } of chunkFiles) {
          formData.append("files", file);
        }

        const res = await fetch("/api/v2/screening/bulk-upload", {
          method: "POST",
          body: formData,
        });

        const result = await res.json();

        if (!res.ok) {
          throw new Error(result.error || "Upload failed");
        }

        if (result.bulkJobId) {
          bulkJobId = result.bulkJobId;
        }

        totalUploaded += chunkFiles.length;
        setUploadProgress(
          Math.round((totalUploaded / validFiles.length) * 100)
        );
      }

      toast.success(
        `Uploaded ${totalUploaded} resumes. Screening pipeline started!`
      );

      if (bulkJobId) {
        onUploadComplete(bulkJobId);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Upload failed"
      );
    } finally {
      setUploading(false);
    }
  }, [files, jobId, topN, uploading, disabled, onUploadComplete]);

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 cursor-pointer ${
          dragActive
            ? "border-primary bg-primary/10 scale-[1.01] shadow-[0_0_30px_rgba(99,102,241,0.15)]"
            : disabled
              ? "border-white/5 bg-white/[0.01] cursor-not-allowed opacity-50"
              : "border-white/10 hover:border-primary/40 hover:bg-white/[0.02]"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={disabled ? undefined : handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          multiple
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
          className="hidden"
          disabled={disabled}
        />

        <div className="relative">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center border border-primary/10">
            <Upload className="w-7 h-7 text-primary" />
          </div>
          <p className="text-foreground font-semibold text-base">
            {dragActive
              ? "Drop resumes here..."
              : "Drop resume files or click to browse"}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Accepted: PDF, DOCX, TXT · Max 10MB per file · Up to 10,000 files
          </p>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-card/60 backdrop-blur-sm overflow-hidden">
          {/* Header */}
          <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  {validCount.toLocaleString()} resume{validCount !== 1 ? "s" : ""}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatFileSize(totalSize)}
              </span>
            </div>
            <button
              onClick={clearAll}
              disabled={uploading}
              className="text-xs text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-40"
            >
              Clear all
            </button>
          </div>

          {/* File preview (show first 8) */}
          <div className="divide-y divide-white/[0.03] max-h-[280px] overflow-y-auto">
            {files.slice(0, 8).map((item, i) => (
              <div
                key={i}
                className="px-5 py-2.5 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
              >
                <File className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">
                    {item.file.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatFileSize(item.file.size)}
                  </p>
                </div>
                {item.status === "done" && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                {item.status === "error" && (
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                )}
                {!uploading && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(i);
                    }}
                    className="text-muted-foreground hover:text-red-400 p-0.5 rounded transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {files.length > 8 && (
            <div className="px-5 py-2 text-xs text-muted-foreground text-center border-t border-white/[0.03]">
              +{(files.length - 8).toLocaleString()} more file{files.length - 8 !== 1 ? "s" : ""}
            </div>
          )}

          {/* Upload Progress Bar */}
          {uploading && (
            <div className="px-5 py-3 border-t border-white/5">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-primary font-medium">
                  Uploading...
                </span>
                <span className="text-muted-foreground">
                  {uploadProgress}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500 transition-all duration-500"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="px-5 py-4 border-t border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="w-3.5 h-3.5" />
              Duplicates will be detected automatically
            </div>
            <button
              onClick={handleUpload}
              disabled={uploading || validCount === 0 || disabled}
              className="flex items-center gap-2 bg-gradient-to-r from-primary to-violet-500 hover:from-primary/90 hover:to-violet-500/90 text-white text-sm font-semibold px-6 py-2.5 rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Start Screening ({validCount.toLocaleString()})
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
