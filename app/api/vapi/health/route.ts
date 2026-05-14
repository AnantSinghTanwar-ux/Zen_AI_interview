import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("https://api.vapi.ai/health", {
      headers: {
        Authorization: `Bearer ${process.env.VAPI_PRIVATE_KEY}`,
      },
      next: { revalidate: 60 }, // Cache for 60 seconds
    });
    
    // Fallback if Vapi doesn't have /health, we can check /assistant to see if API responds
    if (res.status === 404) {
      const checkRes = await fetch("https://api.vapi.ai/assistant", {
        headers: { Authorization: `Bearer ${process.env.VAPI_PRIVATE_KEY}` },
        next: { revalidate: 60 }
      });
      return NextResponse.json({ ok: checkRes.ok, healthScore: checkRes.ok ? 10 : 0 });
    }

    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: res.ok, healthScore: data?.health || 10, ...data });
  } catch (error) {
    return NextResponse.json({ ok: false, healthScore: 0, error: "Network failure" }, { status: 500 });
  }
}
