/**
 * Standalone feedback worker startup script.
 * Run via: npx tsx scripts/start-feedback-worker.ts
 */

import { startFeedbackWorker, stopFeedbackWorker } from "@/services/feedback/feedback-worker";

async function main() {
  console.log("┌────────────────────────────────────────┐");
  console.log("│  ZenAI Feedback Worker                 │");
  console.log("│  Press Ctrl+C to stop                  │");
  console.log("└────────────────────────────────────────┘");

  startFeedbackWorker();

  // Graceful shutdown
  const shutdown = () => {
    console.log("\nShutting down feedback worker...");
    stopFeedbackWorker();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal worker error:", err);
  process.exit(1);
});
