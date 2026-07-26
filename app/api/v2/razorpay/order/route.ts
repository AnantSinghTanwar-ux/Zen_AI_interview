import { NextResponse } from "next/server";
import { razorpay, getRazorpayAmount } from "@/lib/services/razorpay.service";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import crypto from "crypto";

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user || !user.uid) {
      return NextResponse.json(
        { message: "Unauthorized. Please log in first." },
        { status: 401 }
      );
    }

    const amount = getRazorpayAmount();
    const receipt = crypto.randomBytes(10).toString("hex");

    const options = {
      amount,
      currency: "INR",
      receipt,
      notes: {
        userId: user.uid,
        action: "upgrade_to_recruiter",
      },
    };

    const order = await razorpay.orders.create(options);

    if (!order) {
        return NextResponse.json(
            { message: "Failed to create Razorpay order." },
            { status: 500 }
        );
    }

    return NextResponse.json({ 
        orderId: order.id,
        amount: order.amount,
        currency: order.currency
    });
  } catch (error) {
    console.error("Razorpay Order Error:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
