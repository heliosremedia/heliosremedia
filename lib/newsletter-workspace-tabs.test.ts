import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../app/admin/newsletter-studio/components/NewsletterDashboard.tsx",import.meta.url),"utf8");
const editions=source.slice(source.indexOf('{ id: "editions"'),source.indexOf('{ id: "series"'));
const series=source.slice(source.indexOf('{ id: "series"'),source.indexOf('{ id: "history"'));
const history=source.slice(source.indexOf('{ id: "history"'),source.indexOf(']} />'));
test("Newsletter tabs default to Editions, with next edition, content warnings and action queues",()=>{
 assert.match(source,/import AdminWorkspaceTabs from "@\/app\/admin\/components\/AdminWorkspaceTabs"/);
 assert.match(source,/<AdminWorkspaceTabs id="newsletter-studio" label="Newsletter Studio sections" tabs=\{\[\s*\{ id: "editions"/);
 for(const text of ['Next edition','Content warnings','title="Needs Your Review"','editions={needsReview}','title="Scheduled"','editions={scheduled}'])assert.ok(editions.includes(text),text);
 assert.ok(!editions.includes('title="Recent Editions"'));assert.ok(!editions.includes('Active Newsletter Series'));
});
test("Series retains pause, resume and edit controls; History retains recent editions",()=>{
 for(const text of ['Active Newsletter Series','toggleSeries(series.id, series.active)','disabled={toggling}','/admin/newsletter-studio/series/${series.id}','Create your first series'])assert.ok(series.includes(text),text);
 assert.match(history,/title="Recent Editions" editions=\{data.editions.slice\(0, 8\)\}/);
 assert.ok(!history.includes('toggleSeries'));assert.ok(!series.includes('title="Scheduled"'));
});
test("page header, summary and operation status stay outside the tab content",()=>{
 const tabsAt=source.indexOf('<AdminWorkspaceTabs');
 for(const text of ['header={<AdminPageHeader','summary={summary}','{message && <p role="status"','{loading ?'])assert.ok(source.indexOf(text)>0&&source.indexOf(text)<tabsAt,text);
 assert.equal((source.match(/<AdminWorkspaceTabs/g)||[]).length,1);
 assert.match(source,/action\("generate", \{ editionId: data.nextEdition.id \}\)/);
 assert.match(source,/action: active \? "pause-series" : "resume-series", seriesId/);
 assert.match(source,/setData\(current => updateSeriesActive\(current, seriesId, !active\)\)/);
});
