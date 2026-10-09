import React from 'react';
import { createRoot } from 'react-dom/client';
import ProjectDetailsEditor from '../../app/admin/projects/[projectId]/ProjectDetailsEditor';
const fields = ['shortDescription','description','city','state','locationLabel','projectType','propertyType','seoTitle','seoDescription','listingAgent','brokerage','builder','architect','interiorDesigner','squareFeet','bedrooms','bathrooms','lotSize','neighborhood','propertyAddress','propertyWebsiteUrl'];
const initialData = Object.fromEntries(fields.map(field => [field, '']));
Object.assign(initialData, { title: 'Stonewater Sanctuary', slug: 'stonewater-sanctuary', city: 'Fort Collins', state: 'Colorado' });
createRoot(document.getElementById('root')).render(<main className="admin-form-scope min-h-screen bg-[#101112] p-5 text-white"><ProjectDetailsEditor projectId="synthetic" initialData={initialData} initialUpdatedAt="2026-01-01T00:00:00.000Z" statusLabel="Draft" initialAgents={[]} clientOptions={[]} /></main>);
