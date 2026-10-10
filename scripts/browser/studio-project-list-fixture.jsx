import React from 'react';
import { createRoot } from 'react-dom/client';
import ProjectListManager from '../../app/admin/projects/ProjectListManager';
const projects = [
  {id:'draft',title:'A private mountain property with a long descriptive project name',status:'DRAFT',location:'Colorado Springs, Colorado',mediaCount:0},
  {id:'published',title:'City residence',status:'PUBLISHED',location:'Denver, Colorado',mediaCount:12},
  {id:'archived',title:'Retained project',status:'ARCHIVED',location:'Boulder, Colorado',mediaCount:1},
].map(project=>({...project,slug:project.id,shortDescription:'Project details retained for review.',featured:false,updatedAt:'Oct 10, 2026',thumbnailUrl:null,thumbnailAlt:project.title}));
const filtered=new URLSearchParams(window.location.search).has('filtered');
createRoot(document.getElementById('root')).render(<main className="admin-form-scope min-h-screen bg-[#101112] p-4 text-white sm:p-8"><section className="mx-auto max-w-6xl overflow-hidden rounded-2xl border border-white/10"><ProjectListManager workspaceId="a" initialRevision={"a".repeat(64)} initialProjects={projects} allProjectIds={projects.map(p=>p.id)} hasFilters={filtered} pageStart={0} returnTo={filtered?'/admin/projects?status=DRAFT':'/admin/projects'} rangeLabel="Showing 1–3 of 3 projects" /></section></main>);
