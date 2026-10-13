import React from 'react';
import { createRoot } from 'react-dom/client';
import ProjectPreviewManager from '../../app/admin/projects/[projectId]/ProjectPreviewManager';
createRoot(document.getElementById('root')).render(<main className="admin-form-scope min-h-screen bg-[#101112] p-4 text-white sm:p-8"><div id="project-previews" tabIndex={-1} className="mx-auto max-w-5xl"><ProjectPreviewManager projectId="synthetic" initialPreviews={[]} /></div></main>);
