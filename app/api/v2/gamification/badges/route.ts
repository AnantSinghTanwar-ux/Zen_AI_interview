import { NextRequest, NextResponse } from 'next/server';
import { gamificationService } from '@/services/gamification/gamification.service';

export async function GET(request: NextRequest) {
  try {
    const badges = await gamificationService.getBadgesByCategory();
    return NextResponse.json(badges);
  } catch (error) {
    console.error('Error fetching badges:', error);
    return NextResponse.json(
      { error: 'Failed to fetch badges' },
      { status: 500 }
    );
  }
}
