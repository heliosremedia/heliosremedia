import AdminWorkspaceTabs from "../../app/admin/components/AdminWorkspaceTabs";
import FeaturedProjectsManager from "../../app/admin/projects/FeaturedProjectsManager";
import PortfolioDiscoverySettingsManager from "../../app/admin/projects/PortfolioDiscoverySettingsManager";
import AdminShell from "../../app/admin/components/AdminShell";
export default function Preview() {
 return <AdminShell session={{role:'OWNER',email:'qa@example.com',displayName:'Preview',userId:'preview',sessionVersion:0,workspaceId:'preview',exp:0} as never} initialNavigationFavorites={[]} businessName="Helios Real Estate Media">
 <h1 className="text-3xl text-white">Studio appearance preview</h1>
 <p className="mt-3 text-sm text-white/40">Shared workflow controls · local QA only</p>
 <section className="mt-8 rounded-2xl border border-white/10 bg-[#111] p-6">
 <h2 className="text-xl text-white">Project workflow</h2><p className="mt-2 text-sm text-white/50">Consistent surfaces, status, and readable forms in both modes.</p>
 <div className="mt-5 grid gap-4 sm:grid-cols-2"><button className="admin-project-step is-complete"><span className="admin-project-step-content"><span className="admin-project-step-label">Connection</span><span className="admin-project-step-value">Dropbox verified</span><span className="admin-project-step-detail">Ready for uploads</span></span><span className="admin-project-step-check">✓</span></button><button className="admin-project-step"><span><span className="admin-project-step-label">Delivery</span><span className="admin-project-step-value">Review required</span><span className="admin-project-step-detail">Complete the remaining details</span></span></button></div>
 <label className="mt-6 block text-sm text-white/60">Project name<input className="input" placeholder="Enter a project name" /></label><div className="mt-5 flex gap-3"><button className="admin-btn-primary">Save project</button><button className="admin-btn-secondary">Cancel</button><button className="admin-btn-destructive">Delete</button></div>
 <label className="referral-campaign-builder mt-4 flex gap-2"><input type="checkbox" defaultChecked className="referral-form-checkbox" />Include recipients</label>
 <input aria-label="Legacy solid black field" className="bg-black p-2 text-white" placeholder="Legacy field" />
 <div className="mt-6 text-sm text-emerald-200">Verified successfully</div><div className="mt-2 text-sm text-red-300">Action required</div>
 </section>
 <AdminWorkspaceTabs id="projects-workspace" label="Projects workspace sections" tabs={[
   {id:"projects",label:"Projects",hashAliases:["project-results"],content:<section id="project-results"><label>Search fixture projects<input aria-label="Search fixture projects" /></label><p>Project list fixture</p></section>},
   {id:"organization",label:"Portfolio Organization",content:<>
     <FeaturedProjectsManager initialFeatured={[{id:"qa-project",title:"QA Villa",slug:"qa-villa"}]} candidates={[{id:"qa-project",title:"QA Villa",slug:"qa-villa"}]} overLimitCount={1} />
     <PortfolioDiscoverySettingsManager initialSettings={{photoEnabled:true,filmEnabled:true,photoButtonLabel:"Browse All Photography",filmButtonLabel:"Watch All Films",photoOrderingMode:"ROTATING_MIX",filmOrderingMode:"ROTATING_MIX",initialItemCount:24,excludedProjectIds:[],excludedMediaIds:[]}} projects={[]} media={[]} />
   </>},
 ]} />
 </AdminShell>
}
