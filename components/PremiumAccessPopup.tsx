"use client";

import { useState } from "react";
import { X, CreditCard, Sparkles, Shield, Zap } from "lucide-react";
import { useRazorpayCheckout } from "@/hooks/useRazorpayCheckout";

interface PremiumAccessPopupProps {
  open: boolean;
  message?: string;
  onClose: () => void;
  onActivated?: () => void;
  /** Which product to prompt — defaults to "single_interview" */
  suggestedProduct?: "single_interview" | "dsa_practice";
}

const PRODUCT_INFO: Record<
  string,
  { label: string; price: string; icon: React.ReactNode; description: string }
> = {
  single_interview: {
    label: "Interview Session",
    price: "₹399",
    icon: <Sparkles className="w-5 h-5" />,
    description: "30-min AI-powered voice interview with detailed feedback",
  },
  dsa_practice: {
    label: "DSA Practice Session",
    price: "₹99",
    icon: <Zap className="w-5 h-5" />,
    description: "30-min text-based DSA practice with AI interviewer",
  },
};

const DEFAULT_MESSAGE =
  "Purchase a session to access this feature. Your payment is securely processed via Razorpay.";

export default function PremiumAccessPopup({
  open,
  message,
  onClose,
  onActivated,
  suggestedProduct = "single_interview",
}: PremiumAccessPopupProps) {
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState(suggestedProduct);

  const { initiatePayment, isProcessing } = useRazorpayCheckout({
    onSuccess: (result) => {
      setError(null);
      setSuccessMessage(
        `Payment successful! ${result.product?.creditsGranted || 1} session credit(s) added.`
      );
      // Auto-close after showing success
      setTimeout(() => {
        setSuccessMessage(null);
        onActivated?.();
        onClose();
      }, 2000);
    },
    onError: (errorMsg) => {
      setError(errorMsg);
    },
    onDismiss: () => {
      // User closed the modal — do nothing
    },
  });

  if (!open) return null;

  const product = PRODUCT_INFO[selectedProduct];

  const handlePayment = async () => {
    setError(null);
    await initiatePayment(selectedProduct);
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/20 bg-background p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Purchase Required
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close payment popup"
            className="rounded-md border border-white/10 p-1 text-foreground/70 transition-colors hover:bg-white/10 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground mb-5">
          {message || DEFAULT_MESSAGE}
        </p>

        {/* Product Selector */}
        <div className="space-y-2 mb-5">
          {Object.entries(PRODUCT_INFO).map(([id, info]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSelectedProduct(id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 text-left ${
                selectedProduct === id
                  ? "bg-primary/15 border-primary/40 shadow-[0_0_12px_rgba(157,125,249,0.15)]"
                  : "bg-white/[0.04] border-white/10 hover:bg-white/[0.08]"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  selectedProduct === id
                    ? "bg-primary/20 text-primary"
                    : "bg-white/5 text-muted-foreground"
                }`}
              >
                {info.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {info.label}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {info.description}
                </p>
              </div>
              <span className="text-lg font-bold text-foreground shrink-0">
                {info.price}
              </span>
            </button>
          ))}
        </div>

        {/* Security Badge */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
          <Shield className="w-3.5 h-3.5 text-green-400" />
          <span>Secured by Razorpay • 256-bit SSL encryption</span>
        </div>

        {/* Error */}
        {error && (
          <p className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        {/* Success */}
        {successMessage && (
          <p className="mb-3 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-300">
            {successMessage}
          </p>
        )}

        {/* Pay Button */}
        <button
          type="button"
          onClick={handlePayment}
          disabled={isProcessing || !!successMessage}
          className="mt-1 w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 shadow-[0_0_20px_rgba(157,125,249,0.2)] hover:shadow-[0_0_30px_rgba(157,125,249,0.35)]"
        >
          {isProcessing
            ? "Processing..."
            : successMessage
              ? "✓ Payment Complete"
              : `Pay ${product.price} — ${product.label}`}
        </button>

        <p className="text-xs text-muted-foreground text-center mt-3">
          By proceeding, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}
