import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ProjectWorkflowManager from '../../app/admin/projects/[projectId]/ProjectWorkflowManager';
import ProjectEditorSection from '../../app/admin/projects/[projectId]/ProjectEditorSection';
function Fixture() {
  const archived = new URLSearchParams(window.location.search).has('archived');
  const [revision,setRevision]=useState('2026-01-01T00:00:00.000Z');
  const [serviceIds,setServiceIds]=useState(['photo']);
  useEffect(()=>{window.refreshProjectProps=(value,ids=['photo'])=>{setRevision(value);setServiceIds(ids)};window.renderedRevision=revision;},[revision]);
  return <main className="admin-form-scope min-h-screen bg-[#101112] p-4 text-white sm:p-8"><div className="mx-auto max-w-6xl space-y-6">
  <h1 className="text-3xl">Private project setup</h1>
  <ProjectEditorSection id="project-identity" title="Project details" summary="Review the introduction."><input aria-label="Project introduction" /></ProjectEditorSection>
  <ProjectEditorSection id="project-media" title="Media" summary="Review owned project media."><input aria-label="Media notes" /></ProjectEditorSection>
  <ProjectWorkflowManager projectId="synthetic" projectSlug="synthetic" initialUpdatedAt={revision} initialStatus={archived ? "ARCHIVED" : "PUBLISHED"} initialFeatured={!archived} initialFeaturedStartedAt={null} initialFeaturedExpiresAt={null} initialPublishedAt={archived ? null : "2026-01-01T00:00:00.000Z"} heroMediaId={archived ? null : "synthetic-hero"} visibleMediaCount={archived ? 0 : 1} hasProjectSummary={!archived} hasPlayableVideo={false} initialServiceIds={serviceIds} services={[
    {id:'photo',name:'Photography',slug:'photography',description:'Interior and exterior photography for this private project.',active:true,displayOrder:0},
    {id:'film',name:'Property film',slug:'property-film',description:'A guided film of the property.',active:true,displayOrder:1},
    {id:'old',name:'Retired service',slug:'retired',description:'Unavailable for a new selection.',active:false,displayOrder:2},
  ]} />
</div></main>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
