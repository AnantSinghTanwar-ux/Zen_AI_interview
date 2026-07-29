/**
 * Standalone screening pipeline worker startup script.
 * Run via: npx tsx scripts/start-screening-worker.ts
 *
 * This starts all BullMQ workers for the bulk resume screening pipeline:
 *   - Extraction Worker (PDF/DOCX → text + contacts)
 *   - Embedding Worker (text → vector embedding)
 *   - Email Worker (send interview invitations)
 *   - Orchestrator Worker (stage transitions)
 */

import {
  startScreeningWorkers,
  stopScreeningWorkers,
} from "@/services/queue/screening-worker";

async function main() {
  console.log("┌────────────────────────────────────────────┐");
  console.log("│  ZenAI Bulk Screening Pipeline Worker      │");
  console.log("│  Stages: Extract → Embed → Score → Email   │");
  console.log("│  Press Ctrl+C to stop                      │");
  console.log("└────────────────────────────────────────────┘");

  startScreeningWorkers();

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\nShutting down screening workers...");
    await stopScreeningWorkers();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal screening worker error:", err);
  process.exit(1);
});
