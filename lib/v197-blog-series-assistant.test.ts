import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseAssistantBrief, parseBlogSeriesProposal } from "./blog-series-assistant.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const proposal = { seriesName:"Intentional Listing Stories",targetAudience:"Real estate professionals",purpose:"Teach practical property storytelling.",cadence:"BIWEEKLY",generateDaysBefore:7,contentPillars:["Cinematic planning"],brandVoice:"Refined and useful.",subjectsToPrioritize:"Practical preparation",subjectsToAvoid:"Unsupported claims",seoFocus:"real estate media planning",targetArticleLength:1000,preferredCallToAction:"Explore Helios services.",imagePreferences:"Approved portfolio imagery.",roadmap:Array.from({length:6},(_,index)=>({workingTitle:`Article ${index+1}`,primaryTopic:"Planning",searchIntent:"Informational",primaryKeyword:"real estate media",supportingKeywords:["listing media"],articleAngle:"Practical guidance",readerTakeaway:"A clear next step",relevantService:"Cinematic Video",internalLinks:["/services"],mediaCategory:"Cinematic Video",callToAction:"Explore services",publicationOrder:index+1})),conflicts:[],factualConfirmations:[] };

test("validates assistant brief limits and cadence", () => {
  assert.equal(parseAssistantBrief({ concept:"A useful series",audience:"Agents",objective:"Educate",geographicFocus:"",cadence:"BIWEEKLY",direction:"" }).cadence,"BIWEEKLY");
  assert.throws(()=>parseAssistantBrief({ concept:"",audience:"Agents",objective:"Educate",cadence:"BIWEEKLY" }));
});

test("requires a validated roadmap of 6 to 12 articles", () => {
  assert.equal(parseBlogSeriesProposal(proposal).roadmap.length,6);
  assert.throws(()=>parseBlogSeriesProposal({...proposal,roadmap:proposal.roadmap.slice(0,5)}));
});

test("route is authenticated, role restricted, workspace guarded, rate limited, structured, and audit safe", () => {
  const route=read("app/api/admin/blog/series/assistant/route.ts");
  assert.match(route,/getAdminSession\(\)/);assert.match(route,/session\.role === "VIEWER"/);assert.match(route,/workspaceCount !== 1/);assert.match(route,/workspaceId/);assert.match(route,/REQUEST_LIMIT/);assert.match(route,/BLOG_SERIES_AI_PROPOSAL_REQUESTED/);assert.match(route,/json_schema/);assert.match(route,/BLOG_SERIES_AI_PROPOSAL_GENERATED/);assert.doesNotMatch(route,/metadata:\{[^}]*brief/);
});

test("assistant cannot save or publish and preserves review-before-replacement behavior", () => {
  const ui=read("app/admin/blog/BlogSeriesAssistant.tsx");
  assert.match(ui,/Apply All Empty Fields/);assert.match(ui,/Review replacement/);assert.match(ui,/Replace field/);assert.match(ui,/Return to unsaved form/);assert.doesNotMatch(ui,/fetch\("\/api\/admin\/blog\/series"/);assert.doesNotMatch(ui,/onClick=\{[^}]*publish|onClick=\{[^}]*schedule/i);
});

test("assistant has dialog accessibility and responsive containment", () => {
  const ui=read("app/admin/blog/BlogSeriesAssistant.tsx");const dialog=read("app/admin/newsletter-studio/components/AccessibleDialog.tsx");
  assert.match(ui,/aria-live="polite"/);assert.match(ui,/role="alert"/);assert.match(ui,/max-h-\[calc\(100vh-15rem\)\] overflow-y-auto/);assert.match(dialog,/aria-modal="true"/);assert.match(dialog,/previouslyFocused\?\.focus/);assert.match(dialog,/event\.key === "Escape"/);
});

test("expanded series editor has an immediate accessible close action", () => {
  const panel=read("app/admin/blog/BlogSeriesPanel.tsx");
  assert.match(panel,/aria-controls="blog-series-editor"/);
  assert.match(panel,/aria-label="Close Blog Series form">Close Series Form/);
  assert.match(panel,/function closeEditor\(\).*newSeriesRef\.current\?\.focus/);
});
