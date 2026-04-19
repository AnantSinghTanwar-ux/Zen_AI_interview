"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface PremiumAccessPopupProps {
  open: boolean;
  message?: string;
  onClose: () => void;
  onActivated?: () => void;
}

const DEFAULT_MESSAGE =
  "This feature is locked after your first free Vapi AI usage. Upgrade now to continue.";

export default function PremiumAccessPopup({
  open,
  message,
  onClose,
  onActivated,
}: PremiumAccessPopupProps) {
  const [isActivating, setIsActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const activatePremium = async () => {
    setIsActivating(true);
    setError(null);

    try {
      const response = await fetch("/api/premium/activate", {
        method: "POST",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to activate premium access");
      }

      onActivated?.();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to activate premium access";
      setError(message);
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/20 bg-background p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold text-foreground">Premium Required</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close premium popup"
            className="rounded-md border border-white/10 p-1 text-foreground/70 transition-colors hover:bg-white/10 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          {message || DEFAULT_MESSAGE}
        </p>

        {error && (
          <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={activatePremium}
          disabled={isActivating}
          className="mt-5 w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isActivating ? "Activating..." : "Yes I am a premium user"}
        </button>
      </div>
    </div>
  );
}
