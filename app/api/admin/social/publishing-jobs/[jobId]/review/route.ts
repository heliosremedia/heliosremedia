import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/session';
import { inspectPublishingReview } from '@/lib/social/publishing-review';

export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const session = await getAdminSession();
    if (!session) return json({ success: false, error: 'Unauthorized' }, 401);
    const { jobId } = await context.params;
    if (!jobId || jobId.length > 120) return json({ success: false, error: 'Invalid publishing job.' }, 400);
    return json({ success: true, review: await inspectPublishingReview(jobId, {
      userId: session.userId, workspaceId: session.workspaceId, sessionVersion: session.sessionVersion,
    }) });
  } catch (error) {
    if (error instanceof Error && error.message === 'WORKSPACE_WRITE_FORBIDDEN') return json({ success: false, error: 'Administrator access is required.' }, 403);
    if (error instanceof Error && error.message === 'PUBLISHING_REVIEW_NOT_FOUND') return json({ success: false, error: 'Publishing job not found.' }, 404);
    return json({ success: false, error: 'Publication evidence is unavailable. Nothing has been retried or changed.' }, 500);
  }
}
