-- CreateTable
CREATE TABLE IF NOT EXISTS "pipeline_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID NOT NULL,
    "previous_status" "application_status",
    "new_status" "application_status" NOT NULL,
    "changed_by_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_pipeline_events_application" ON "pipeline_events"("application_id");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'pipeline_events_application_id_fkey'
    ) THEN
        ALTER TABLE "pipeline_events"
        ADD CONSTRAINT "pipeline_events_application_id_fkey"
        FOREIGN KEY ("application_id") REFERENCES "applications"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION;
    END IF;
END
$$;

