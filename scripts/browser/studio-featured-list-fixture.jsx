import React from 'react';
import { createRoot } from 'react-dom/client';
import FeaturedProjectsManager from '../../app/admin/projects/FeaturedProjectsManager';
const projects = Array.from({length:7},(_,i)=>({id:`p${i+1}`,title:`Project ${i+1}`,slug:`project-${i+1}`}));
createRoot(document.getElementById('root')).render(<main className="admin-form-scope min-h-screen bg-[#101112] p-4 text-white sm:p-8"><div className="mx-auto max-w-6xl space-y-6"><h1 className="text-3xl">Workspace projects</h1><label>Local project note<input aria-label="Local project note" className="block border border-white/20 p-2" /></label><FeaturedProjectsManager workspaceId="synthetic" initialRevision={'a'.repeat(64)} initialFeatured={projects.slice(0,6)} candidates={projects} overLimitCount={6}/></div></main>);
