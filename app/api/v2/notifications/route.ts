import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { notificationService } from "@/services/recruiter/notification.service";

/**
 * GET /api/v2/notifications — Get notifications for the current user.
 * Supports: ?unreadOnly=true, ?limit=N
 *
 * PATCH /api/v2/notifications — Mark notification(s) as read.
 * Body: { notificationId?: string, markAll?: boolean }
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const limit = Math.min(
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20),
      50
    );

    const [notifications, unreadCount] = await Promise.all([
      notificationService.getNotifications(user.id, { unreadOnly, limit }),
      notificationService.getUnreadCount(user.id),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error("[GET /api/v2/notifications] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    if (body.markAll === true) {
      const count = await notificationService.markAllAsRead(user.id);
      return NextResponse.json({ success: true, markedCount: count });
    }

    if (typeof body.notificationId === "string" && body.notificationId.trim()) {
      await notificationService.markAsRead(body.notificationId, user.id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Provide notificationId or markAll: true" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[PATCH /api/v2/notifications] Error:", error);
    return NextResponse.json(
      { error: "Failed to update notifications" },
      { status: 500 }
    );
  }
}
