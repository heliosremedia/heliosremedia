import test from "node:test";
import assert from "node:assert/strict";
import { compareGroups, deterministicBrief, latestSnapshots, safeSummary } from "./analytics-core.ts";

test("unknown metrics stay unavailable instead of becoming zero",()=>{assert.equal(safeSummary([{platform:"INSTAGRAM",category:"reach",providerName:"reach",value:null,availability:"NOT_AVAILABLE",measuredAt:new Date()}]).reach,null);});
test("newer cumulative snapshots replace older values",()=>{const rows=[1,2].map((value,index)=>({platform:"INSTAGRAM",variantId:"v1",category:"likes",providerName:"likes",value,availability:"AVAILABLE" as const,measuredAt:new Date(2026,0,index+1)}));assert.equal(latestSnapshots(rows)[0].value,2);});
test("safe summary never sums engagement rates",()=>{const now=new Date();const result=safeSummary([{platform:"LINKEDIN",category:"impressions",providerName:"impressionCount",value:100,availability:"AVAILABLE",measuredAt:now},{platform:"LINKEDIN",category:"likes",providerName:"likeCount",value:5,availability:"AVAILABLE",measuredAt:now},{platform:"LINKEDIN",category:"engagement_rate",providerName:"engagement",value:80,availability:"AVAILABLE",measuredAt:now}]);assert.equal(result.engagementRate,5);});
test("comparison discloses small samples",()=>{assert.equal(compareGroups([{label:"Carousel",postCount:2,metricTotal:20}])[0].conclusionAllowed,false);});
test("fallback briefing mentions limited evidence",()=>{assert.match(deterministicBrief({published:2,metrics:{reach:null,impressions:null,engagements:4,engagementRate:null,linkClicks:null,videoViews:null},sampleSize:2,stale:false}),/sample is limited/);});
