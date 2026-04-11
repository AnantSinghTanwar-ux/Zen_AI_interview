import { NextRequest, NextResponse } from "next/server";
import { callLogService } from "@/services/firebase/call-log.service";
import { getCurrentUser } from "@/lib/actions/auth.actions";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { userId } = await request.json();
    const targetUserId = userId || user.id;

    await callLogService.addUserIdToExistingLogs(targetUserId);

    return NextResponse.json({
      success: true,
      message: "Successfully updated existing call logs with userId",
    });
  } catch (error) {
    console.error("Error updating existing call logs:", error);
    return NextResponse.json(
      { error: "Failed to update existing call logs" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const logsWithoutUserId =
      await callLogService.getAllCallLogsWithoutUserId();

    return NextResponse.json({
      count: logsWithoutUserId.length,
      logs: logsWithoutUserId,
    });
  } catch (error) {
    console.error("Error fetching logs without userId:", error);
    return NextResponse.json(
      { error: "Failed to fetch logs without userId" },
      { status: 500 }
    );
  }
}
