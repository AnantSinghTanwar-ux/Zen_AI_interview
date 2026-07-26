"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Script from "next/script";

export default function PricingPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      // 1. Create order
      const orderRes = await fetch("/api/v2/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const orderData = await orderRes.json();

      if (!orderRes.ok) {
        throw new Error(orderData.message || "Failed to create order.");
      }

      // 2. Open Razorpay checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, // Enter the Key ID generated from the Dashboard
        amount: orderData.amount, // Amount is in currency subunits. Default currency is INR. Hence, 50000 refers to 50000 paise
        currency: orderData.currency,
        name: "ZenAI Recruiter",
        description: "Upgrade to Recruiter Access",
        order_id: orderData.orderId, //This is a sample Order ID. Pass the `id` obtained in the response of Step 1
        handler: async function (response: any) {
            try {
                const verifyRes = await fetch("/api/v2/razorpay/verify", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_signature: response.razorpay_signature,
                    })
                });
                
                const verifyData = await verifyRes.json();
                if (verifyRes.ok && verifyData.success) {
                    toast.success("Payment successful! Redirecting to dashboard...");
                    router.push("/recruiter");
                } else {
                    toast.error("Payment verification failed.");
                }
            } catch (err) {
                toast.error("An error occurred during verification.");
            }
        },
        theme: {
            color: "#6366f1"
        }
      };
      
      const rzp1 = new (window as any).Razorpay(options);
      rzp1.on('payment.failed', function (response: any){
              toast.error(response.error.description);
      });
      rzp1.open();
    } catch (error) {
      console.error(error);
      toast.error((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      <div className="min-h-screen pt-32 pb-16 px-4 md:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-4 text-black">
            Unlock Recruiter Access
          </h1>
          <p className="text-lg text-black/60 font-bold max-w-2xl mx-auto">
            Get unlimited access to AI-powered interviews, candidate screening, and advanced analytics to hire the top 1% of talent.
          </p>
        </div>

        <div className="max-w-md mx-auto">
          <div className="glass-card p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-primary text-white text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-bl-lg">
              Most Popular
            </div>
            
            <div className="flex items-center gap-2 mb-4 text-primary">
              <Sparkles className="w-5 h-5" />
              <span className="font-bold uppercase tracking-wide">Pro Recruiter</span>
            </div>
            
            <div className="mb-8">
              <span className="text-5xl font-black text-black">₹4900</span>
              <span className="text-black/50 font-bold">/month</span>
            </div>
            
            <ul className="space-y-4 mb-8">
              {[
                "Unlimited AI mock interviews",
                "Automated resume screening",
                "Advanced candidate analytics",
                "Priority support",
                "Custom interview scenarios"
              ].map((feature, i) => (
                <li key={i} className="flex items-start gap-3 text-black font-semibold">
                  <Check className="w-5 h-5 text-primary shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            
            <Button 
              className="w-full btn btn-primary text-lg py-6"
              onClick={handleUpgrade}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Upgrade Now"}
            </Button>
            
            <p className="text-center text-sm text-black/40 font-bold mt-4">
              Secure payment powered by Razorpay
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
