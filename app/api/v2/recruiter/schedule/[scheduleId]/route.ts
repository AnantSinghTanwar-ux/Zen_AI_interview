import { NextRequest, NextResponse } from "next/server";
import { recruiterGuard } from "@/app/api/v2/recruiter/_guard";
import { schedulingService } from "@/services/recruiter/scheduling.service";
import { recruiterService } from "@/services/recruiter/recruiter.service";

/**
 * PUT /api/v2/recruiter/schedule/[scheduleId] — Update a schedule.
 * DELETE /api/v2/recruiter/schedule/[scheduleId] — Cancel a schedule.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ scheduleId: string }> }
) {
  const { user, error } = await recruiterGuard();
  if (error) return error;

  try {
    const { scheduleId } = await params;
    const recruiter = await recruiterService.getRecruiterByUserId(user!.id);
    if (!recruiter) {
      return NextResponse.json({ error: "Recruiter profile not found" }, { status: 403 });
    }

    const schedule = await schedulingService.getSchedule(scheduleId);
    if (!schedule || schedule.recruiterId !== recruiter.id) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.scheduledAt) updates.scheduledAt = body.scheduledAt;
    if (body.duration) updates.duration = body.duration;
    if (typeof body.meetingLink === "string") updates.meetingLink = body.meetingLink;
    if (typeof body.notes === "string") updates.notes = body.notes;
    if (body.status) updates.status = body.status;

    await schedulingService.updateSchedule(scheduleId, updates as any);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update schedule";
    console.error("[PUT /api/v2/recruiter/schedule/[scheduleId]] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ scheduleId: string }> }
) {
  const { user, error } = await recruiterGuard();
  if (error) return error;

  try {
    const { scheduleId } = await params;
    const recruiter = await recruiterService.getRecruiterByUserId(user!.id);
    if (!recruiter) {
      return NextResponse.json({ error: "Recruiter profile not found" }, { status: 403 });
    }

    const schedule = await schedulingService.getSchedule(scheduleId);
    if (!schedule || schedule.recruiterId !== recruiter.id) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    await schedulingService.cancelSchedule(scheduleId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/v2/recruiter/schedule/[scheduleId]] Error:", err);
    return NextResponse.json({ error: "Failed to cancel schedule" }, { status: 500 });
  }
}
