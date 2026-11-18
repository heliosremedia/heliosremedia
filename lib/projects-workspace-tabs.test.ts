import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/admin/projects/page.tsx",import.meta.url),"utf8");
test("Projects opens to its list and separates the two portfolio organization editors",()=>{
 assert.match(source,/<AdminWorkspaceTabs id="projects-workspace" label="Projects workspace sections" tabs=\{\[\s*\{ id: "projects", label: "Projects", hashAliases: \["project-results"\]/);
 const split=source.indexOf('{ id: "organization", label: "Portfolio Organization"');
 assert.ok(split>0);
 const list=source.slice(source.indexOf('<AdminWorkspaceTabs'),split), organization=source.slice(split);
 for(const component of ['ThumbnailRepairButton','ProjectListManager'])assert.ok(list.includes(`<${component}`));
 for(const component of ['FeaturedProjectsManager','PortfolioDiscoverySettingsManager']){
  assert.ok(!list.includes(`<${component}`));
  assert.equal(organization.split(`<${component}`).length-1,1);
 }
 assert.match(list,/id="project-results"/);
 assert.match(list,/action="\/admin\/projects#project-results"/);
});
test("the existing persistent tabs preserve draft state and selection without saving",()=>{
 const tabs=readFileSync(new URL("../app/admin/components/AdminWorkspaceTabs.tsx",import.meta.url),"utf8");
 assert.match(tabs,/tabs.map\(tab => <section/);
 assert.match(tabs,/hidden=\{active !== tab.id\}/);
 assert.doesNotMatch(tabs,/fetch\(|router.refresh/);
 assert.match(tabs,/role="tablist"/);
 assert.match(tabs,/flex-wrap/);
});
