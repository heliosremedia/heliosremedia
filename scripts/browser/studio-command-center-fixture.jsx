import React from 'react';
import { createRoot } from 'react-dom/client';
import StudioShell from '../../app/admin/components/StudioShell';
import CommandCenter from '../../app/admin/studio/CommandCenter';
const mode = new URL(location.href).searchParams.get('mode');
const empty = mode === 'empty';
const data = {
  generatedAt: new Date('2026-10-08T15:00:00Z'),
  operations: { available: mode !== 'unavailable', data: {
    attention: empty ? [] : [{ id: 'review', severity: 'critical', type: 'Newsletter', message: 'Autumn edition requires a delivery review.', href: '/admin/newsletter-studio/editions/synthetic', action: 'Review delivery', date: new Date() }],
    upcoming: empty ? [] : [{ id: 'schedule', type: 'Social', title: 'Mountain sanctuary film', date: new Date('2026-10-10T16:30:00Z'), href: '/admin/social-studio/campaigns/synthetic', state: 'Scheduled' }],
    bookingMode: null,
  } },
  website: { available: mode !== 'unavailable', data: { totalProjects: empty ? 0 : 12, recentProjects: empty ? [] : [{ id: 'synthetic', title: 'Stonewater Sanctuary', status: 'DRAFT', city: 'Fort Collins', state: 'CO', updatedAt: new Date() }] } },
};
createRoot(document.getElementById('root')).render(<StudioShell businessName="Synthetic Northern Colorado Media" session={{ workspaceId: 'synthetic', role: 'OWNER', displayName: 'Synthetic owner' }}><CommandCenter data={data}/></StudioShell>);
