import React from 'react';
import { createRoot } from 'react-dom/client';
import NewProjectForm from '../../app/admin/projects/new/NewProjectForm';
createRoot(document.getElementById('root')).render(<main className="admin-form-scope min-h-screen bg-[#101112] p-5 text-white"><h1 className="mb-6 text-3xl">Create a project</h1><NewProjectForm requestId="00000000-0000-4000-8000-000000000001" /></main>);
