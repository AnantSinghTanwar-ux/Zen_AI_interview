import { NextResponse } from "next/server";
import { getLimitedOfferCount } from "@/lib/services/payment.service";

export async function GET() {
  try {
    const count = await getLimitedOfferCount();
    
    if (count < 10) {
      return NextResponse.json({ 
        price: 149, 
        productId: "limited_offer_interview", 
        remaining: 10 - count 
      });
    }
    
    return NextResponse.json({ 
      price: 399, 
      productId: "single_interview", 
      remaining: 0 
    });
  } catch (error) {
    console.error("Failed to fetch interview price:", error);
    // Fallback to standard price
    return NextResponse.json({ 
      price: 399, 
      productId: "single_interview", 
      remaining: 0 
    });
  }
}
