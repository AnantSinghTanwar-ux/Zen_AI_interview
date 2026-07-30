import { NextRequest } from "next/server";
import { createClient } from "redis";
import {
  REDIS_PROGRESS_KEY_PREFIX,
  SSE_PROGRESS_INTERVAL_MS,
} from "@/constants/screening.config";

// ─── GET /api/v2/screening/progress?jobId=xxx ───────────────────────────────
//
// Server-Sent Events (SSE) endpoint for real-time pipeline progress.
// The frontend connects via EventSource and receives JSON progress updates.
//
// Events format:
//   data: { jobId, stage, progress, totalResumes, topN, message, estimatedSecondsRemaining }

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");

  if (!jobId) {
    return new Response("Missing jobId parameter", { status: 400 });
  }

  const encoder = new TextEncoder();
  let redisClient: ReturnType<typeof createClient> | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        redisClient = createClient({
          url: process.env.REDIS_URL || process.env.KV_URL || "redis://localhost:6379",
        });
        redisClient.on("error", () => {
          // Silently handle Redis errors — the SSE will just stop updating
        });
        await redisClient.connect();

        let lastData = "";

        // Send an initial comment to establish the connection
        controller.enqueue(encoder.encode(": connected\n\n"));

        intervalId = setInterval(async () => {
          try {
            if (!redisClient) return;

            const progress = await redisClient.get(
              `${REDIS_PROGRESS_KEY_PREFIX}${jobId}`
            );

            if (!progress) return;

            // Only send if data has changed
            if (progress === lastData) return;
            lastData = progress;

            controller.enqueue(
              encoder.encode(`data: ${progress}\n\n`)
            );

            // Check if pipeline is complete or failed
            const parsed = JSON.parse(progress);
            if (
              parsed.stage === "completed" ||
              parsed.stage === "failed"
            ) {
              // Send final event and close
              if (intervalId) clearInterval(intervalId);

              // Give a moment for the client to receive the final event
              setTimeout(async () => {
                try {
                  controller.close();
                } catch {
                  // Stream may already be closed
                }
                if (redisClient) {
                  await redisClient.quit().catch(() => {});
                  redisClient = null;
                }
              }, 1000);
            }
          } catch {
            // Silently handle — the connection may have been closed by the client
          }
        }, SSE_PROGRESS_INTERVAL_MS);
      } catch (err) {
        console.error("[SSE Progress] Error:", err);
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ stage: "failed", message: "SSE connection error" })}\n\n`
            )
          );
          controller.close();
        } catch {
          // Stream may already be closed
        }
      }
    },

    cancel() {
      // Client disconnected
      if (intervalId) clearInterval(intervalId);
      if (redisClient) {
        redisClient.quit().catch(() => {});
        redisClient = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
