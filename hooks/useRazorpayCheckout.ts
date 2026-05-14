"use client";

import { useState, useCallback } from "react";

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface PaymentResult {
  success: boolean;
  credits?: {
    interviews: number;
    dsaSessions: number;
  };
  product?: {
    id: string;
    name: string;
    creditsGranted: number;
  };
  error?: string;
}

interface UseRazorpayCheckoutProps {
  onSuccess?: (result: PaymentResult) => void;
  onError?: (error: string) => void;
  onDismiss?: () => void;
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: Record<string, unknown>) => void) => void;
    };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function useRazorpayCheckout({
  onSuccess,
  onError,
  onDismiss,
}: UseRazorpayCheckoutProps = {}) {
  const [isProcessing, setIsProcessing] = useState(false);

  const initiatePayment = useCallback(
    async (productId: string) => {
      if (isProcessing) return;
      setIsProcessing(true);

      try {
        // 1. Load Razorpay script
        const loaded = await loadRazorpayScript();
        if (!loaded) {
          throw new Error("Failed to load Razorpay. Please check your internet connection.");
        }

        // 2. Create order from backend
        const orderRes = await fetch("/api/razorpay/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId }),
        });

        if (orderRes.status === 401) {
          window.location.href = "/sign-in";
          return;
        }

        if (!orderRes.ok) {
          const errorData = await orderRes.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Failed to create order (${orderRes.status})`
          );
        }

        const orderData = await orderRes.json();

        // 3. Open Razorpay modal
        const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
        if (!keyId) {
          throw new Error("Payment configuration missing");
        }

        return new Promise<PaymentResult>((resolve, reject) => {
          const options = {
            key: keyId,
            amount: orderData.amount,
            currency: orderData.currency,
            name: "ZenAI",
            description: orderData.productName,
            order_id: orderData.orderId,
            prefill: {},
            theme: {
              color: "#9D7DF9",
              backdrop_color: "rgba(0, 0, 0, 0.85)",
            },
            modal: {
              ondismiss: () => {
                setIsProcessing(false);
                onDismiss?.();
                resolve({ success: false, error: "Payment cancelled" });
              },
              confirm_close: true,
              escape: true,
            },
            handler: async (response: RazorpayResponse) => {
              try {
                // 4. Verify payment on backend
                const verifyRes = await fetch("/api/razorpay/verify-payment", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_signature: response.razorpay_signature,
                    productId,
                  }),
                });

                if (!verifyRes.ok) {
                  const errorData = await verifyRes.json().catch(() => ({}));
                  throw new Error(
                    errorData.error || "Payment verification failed"
                  );
                }

                const result: PaymentResult = await verifyRes.json();
                result.success = true;
                onSuccess?.(result);
                resolve(result);
              } catch (verifyError) {
                const msg =
                  verifyError instanceof Error
                    ? verifyError.message
                    : "Verification failed";
                onError?.(msg);
                reject(new Error(msg));
              } finally {
                setIsProcessing(false);
              }
            },
          };

          const rzp = new window.Razorpay(options);

          rzp.on("payment.failed", (response: Record<string, unknown>) => {
            const errorDesc =
              (response.error as Record<string, unknown>)?.description ||
              "Payment failed";
            setIsProcessing(false);
            onError?.(String(errorDesc));
            resolve({
              success: false,
              error: String(errorDesc),
            });
          });

          rzp.open();
        });
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "Payment failed";
        setIsProcessing(false);
        onError?.(msg);
        return { success: false, error: msg } as PaymentResult;
      }
    },
    [isProcessing, onSuccess, onError, onDismiss]
  );

  return {
    initiatePayment,
    isProcessing,
  };
}
