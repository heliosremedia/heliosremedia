import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/session';
import { listAnalyticsRecovery } from '@/lib/social/analytics-recovery';

export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return json({ success: false, error: 'Unauthorized' }, 401);
    return json({ success: true, ...await listAnalyticsRecovery({ userId: session.userId,
      workspaceId: session.workspaceId, sessionVersion: session.sessionVersion }) });
  } catch (error) {
    if (error instanceof Error && error.message === 'WORKSPACE_WRITE_FORBIDDEN')
      return json({ success: false, error: 'Administrator access is required.' }, 403);
    return json({ success: false, error: 'Analytics jobs are unavailable. Refresh to inspect them again.' }, 500);
  }
}
