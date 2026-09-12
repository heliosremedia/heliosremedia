import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/session';
import { inspectAnalyticsRecovery, cancelReviewedAnalytics } from '@/lib/social/analytics-recovery';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ jobId: string }> };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
function failure(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  if (code === 'WORKSPACE_WRITE_FORBIDDEN') return json({ success: false, error: 'Administrator access is required.' }, 403);
  if (code === 'ANALYTICS_RECOVERY_NOT_FOUND') return json({ success: false, error: 'Analytics job not found.' }, 404);
  if (code === 'ANALYTICS_RECOVERY_DISABLED') return json({ success: false, error: 'Analytics cancellation is not enabled.' }, 409);
  if (code === 'ANALYTICS_RECOVERY_CHANGED') return json({ success: false, error: 'The analytics job changed or is not eligible. Review it again.' }, 409);
  return json({ success: false, error: 'The outcome could not be confirmed. Refresh the job before taking another action.' }, 500);
}

export async function GET(_request: Request, context: Context) {
  try {
    const session = await getAdminSession();
    if (!session) return json({ success: false, error: 'Unauthorized' }, 401);
    const { jobId } = await context.params;
    if (!jobId || jobId.length > 120) return json({ success: false, error: 'Invalid job.' }, 400);
    return json({ success: true, review: await inspectAnalyticsRecovery(jobId, {
      userId: session.userId, workspaceId: session.workspaceId, sessionVersion: session.sessionVersion,
    }) });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request, context: Context) {
  try {
    const session = await getAdminSession();
    if (!session) return json({ success: false, error: 'Unauthorized' }, 401);
    const { jobId } = await context.params;
    let body: unknown;
    try { body = await request.json(); } catch { return json({ success: false, error: 'Invalid request.' }, 400); }
    if (!jobId || jobId.length > 120 || !body || typeof body !== 'object') return json({ success: false, error: 'Invalid request.' }, 400);
    const input = body as Record<string, unknown>;
    if (input.action !== 'cancel' || input.confirmed !== true || typeof input.reviewVersion !== 'string'
      || !/^[a-f0-9]{64}$/.test(input.reviewVersion)) return json({ success: false, error: 'Review and confirm cancellation first.' }, 400);
    return json({ success: true, result: await cancelReviewedAnalytics(jobId, input.reviewVersion, {
      userId: session.userId, workspaceId: session.workspaceId, sessionVersion: session.sessionVersion,
    }) });
  } catch (error) { return failure(error); }
}
