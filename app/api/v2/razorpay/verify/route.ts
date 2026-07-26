import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/services/firebase/admin";
import { getCurrentUser } from "@/lib/actions/auth.actions";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user || !user.uid) {
      return NextResponse.json(
        { message: "Unauthorized. Please log in first." },
        { status: 401 }
      );
    }

    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
    } = await req.json();

    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!secret) {
        return NextResponse.json(
            { message: "Server configuration error." },
            { status: 500 }
        );
    }

    // Verify the signature
    const shasum = crypto.createHmac("sha256", secret);
    shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = shasum.digest("hex");

    if (digest !== razorpay_signature) {
        return NextResponse.json(
            { message: "Payment verification failed. Invalid signature." },
            { status: 400 }
        );
    }

    // If verification is successful, upgrade user
    await db.collection("users").doc(user.uid).set(
        {
          userType: "recruiter",
          recruiterAccessGrantedAt: new Date().toISOString(),
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
        },
        { merge: true }
    );

    return NextResponse.json({ success: true, message: "Payment verified successfully" });
  } catch (error) {
    console.error("Razorpay Verify Error:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
