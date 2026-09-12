import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { queueAnalyticsRefresh } from '@/lib/social/analytics';
import { requireLockedWorkspaceAdministrator } from '@/lib/workspace-write-access';

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function POST(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return json({ success: false, error: 'Unauthorized' }, 401);
    let body: unknown;
    try { body = await request.json(); } catch { return json({ success: false, error: 'Invalid request.' }, 400); }
    if (!body || typeof body !== 'object') return json({ success: false, error: 'Invalid request.' }, 400);
    const input = body as Record<string, unknown>;
    if (input.action !== 'refresh' || typeof input.connectionId !== 'string' || !input.connectionId.trim() || input.connectionId.length > 120)
      return json({ success: false, error: 'Unsupported action or connection.' }, 400);
    const connectionId = input.connectionId.trim();
    const result = await prisma.$transaction(async tx => {
      await requireLockedWorkspaceAdministrator(tx, { userId: session.userId, workspaceId: session.workspaceId, sessionVersion: session.sessionVersion });
      const connection = await tx.socialConnection.findFirst({ where: { id: connectionId, workspaceId: session.workspaceId }, select: { id: true, state: true } });
      if (!connection) return { error: 'Connection not found.', status: 404 };
      if (!['CONNECTED', 'CONNECTED_DIRECT_PUBLISHING_DISABLED'].includes(connection.state))
        return { error: 'Connect or reauthorize this account before refreshing analytics.', status: 409 };
      const days = Math.max(1, Math.min(90, Number(input.days) || 30));
      const end = new Date();
      await queueAnalyticsRefresh(connection.id, new Date(end.getTime() - days * 86_400_000), end, tx);
      return { status: 200 };
    });
    if ('error' in result) return json({ success: false, error: result.error }, result.status);
    return json({ success: true, message: 'Analytics refresh queued. Publishing will continue independently.' });
  } catch (error) {
    if (error instanceof Error && error.message === 'WORKSPACE_WRITE_FORBIDDEN') return json({ success: false, error: 'Administrator access is required.' }, 403);
    return json({ success: false, error: 'The refresh request could not be confirmed. Check the queue before requesting another refresh.' }, 500);
  }
}
