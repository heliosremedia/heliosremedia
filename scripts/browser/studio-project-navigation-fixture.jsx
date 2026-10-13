import React from 'react';
import {createRoot} from 'react-dom/client';
import ProjectProgressCard from '../../app/admin/projects/[projectId]/ProjectProgressCard';
import ProjectSectionLink from '../../app/admin/projects/[projectId]/ProjectSectionLink';
import ProjectEditorSection from '../../app/admin/projects/[projectId]/ProjectEditorSection';
import AdminSectionNavigator from '../../app/admin/components/AdminSectionNavigator';
const steps=[['identity','Details','Project Identity','Add summary'],['media','Media','Media','0 assets'],['services','Services','Services and SEO','0 selected'],['publishing','Publish','Review and Publish','Draft']];
window.fixtureBoots=(window.fixtureBoots||0)+1;
createRoot(document.getElementById('root')).render(<main className="mx-auto max-w-6xl space-y-6 px-4 pb-40 pt-24">
  <h1 className="text-3xl text-white">Private project setup</h1>
  <p className="text-sm text-white/65">Synthetic workspace. Follow the existing project workflow.</p>
  <AdminSectionNavigator label="Project Editor sections" projectEditor sections={steps.map(([id,,title])=>({href:`#project-${id}`,label:title}))} bulkSectionIds={steps.map(([id])=>`project-${id}`)}/>
  <section className="grid gap-4 md:grid-cols-4">{steps.map(([id,label,,detail],i)=><ProjectProgressCard key={id} number={`0${i+1}`} label={label} detail={detail} href={`#project-${id}`} complete={false}/>)}</section>
  {steps.map(([id,,title])=><ProjectEditorSection key={id} id={`project-${id}`} title={title} summary={`Review the ${title.toLowerCase()} for this private draft.`}>
    <label className="block text-sm text-white/75">{title} draft<input className="mt-3 min-h-12 w-full rounded-xl border border-white/15 px-4" defaultValue=""/></label>
    {id==='identity'&&<ProjectSectionLink href="#project-media" className="admin-btn-primary mt-5 text-[#171515]! hover:text-[#f5f1ea]!">Upload media</ProjectSectionLink>}
  </ProjectEditorSection>)}
</main>);
