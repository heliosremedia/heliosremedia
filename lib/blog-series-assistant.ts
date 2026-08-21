export type SeriesCadence = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

export type BlogSeriesAssistantBrief = {
  concept: string;
  audience: string;
  objective: string;
  geographicFocus: string;
  cadence: SeriesCadence;
  direction: string;
};

export type RoadmapArticle = {
  workingTitle: string;
  primaryTopic: string;
  searchIntent: string;
  primaryKeyword: string;
  supportingKeywords: string[];
  articleAngle: string;
  readerTakeaway: string;
  relevantService: string;
  internalLinks: string[];
  mediaCategory: string;
  callToAction: string;
  publicationOrder: number;
};

export type ContentConflict = {
  conflictingContent: string;
  reason: string;
  differentiation: string;
  revisedTopic: string;
};

export type BlogSeriesProposal = {
  seriesName: string;
  targetAudience: string;
  purpose: string;
  cadence: SeriesCadence;
  generateDaysBefore: number;
  contentPillars: string[];
  brandVoice: string;
  subjectsToPrioritize: string;
  subjectsToAvoid: string;
  seoFocus: string;
  targetArticleLength: number;
  preferredCallToAction: string;
  imagePreferences: string;
  roadmap: RoadmapArticle[];
  conflicts: ContentConflict[];
  factualConfirmations: string[];
};

const clean = (value: unknown, max: number, required = true) => {
  const result = typeof value === "string" ? value.trim() : "";
  if ((required && !result) || result.length > max) throw new Error("INVALID_AI_PROPOSAL");
  return result;
};
const list = (value: unknown, maxItems: number, itemMax: number) => {
  if (!Array.isArray(value)) throw new Error("INVALID_AI_PROPOSAL");
  return value.map(item => clean(item, itemMax)).slice(0, maxItems);
};
const cadence = (value: unknown): SeriesCadence => {
  if (value !== "WEEKLY" && value !== "BIWEEKLY" && value !== "MONTHLY") throw new Error("INVALID_AI_PROPOSAL");
  return value;
};

export function parseAssistantBrief(value: unknown): BlogSeriesAssistantBrief {
  if (!value || typeof value !== "object") throw new Error("INVALID_BRIEF");
  const body = value as Record<string, unknown>;
  return {
    concept: clean(body.concept, 1200), audience: clean(body.audience, 500), objective: clean(body.objective, 800),
    geographicFocus: clean(body.geographicFocus, 300, false), cadence: cadence(body.cadence), direction: clean(body.direction, 1200, false),
  };
}

export function parseBlogSeriesProposal(value: unknown): BlogSeriesProposal {
  if (!value || typeof value !== "object") throw new Error("INVALID_AI_PROPOSAL");
  const body = value as Record<string, unknown>;
  if (!Array.isArray(body.roadmap) || body.roadmap.length < 6 || body.roadmap.length > 12) throw new Error("INVALID_AI_PROPOSAL");
  const roadmap = body.roadmap.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error("INVALID_AI_PROPOSAL");
    const row = item as Record<string, unknown>;
    return {
      workingTitle: clean(row.workingTitle, 180), primaryTopic: clean(row.primaryTopic, 300), searchIntent: clean(row.searchIntent, 300),
      primaryKeyword: clean(row.primaryKeyword, 160), supportingKeywords: list(row.supportingKeywords, 8, 100), articleAngle: clean(row.articleAngle, 600),
      readerTakeaway: clean(row.readerTakeaway, 500), relevantService: clean(row.relevantService, 180), internalLinks: list(row.internalLinks, 8, 300),
      mediaCategory: clean(row.mediaCategory, 180), callToAction: clean(row.callToAction, 300), publicationOrder: Math.max(1, Math.min(12, Number(row.publicationOrder) || index + 1)),
    };
  }).sort((a, b) => a.publicationOrder - b.publicationOrder);
  const conflicts = Array.isArray(body.conflicts) ? body.conflicts.slice(0, 20).map(item => {
    if (!item || typeof item !== "object") throw new Error("INVALID_AI_PROPOSAL");
    const row = item as Record<string, unknown>;
    return { conflictingContent: clean(row.conflictingContent, 240), reason: clean(row.reason, 500), differentiation: clean(row.differentiation, 500), revisedTopic: clean(row.revisedTopic, 240) };
  }) : [];
  return {
    seriesName: clean(body.seriesName, 150), targetAudience: clean(body.targetAudience, 1000), purpose: clean(body.purpose, 3000), cadence: cadence(body.cadence),
    generateDaysBefore: Math.max(1, Math.min(30, Number(body.generateDaysBefore) || 7)), contentPillars: list(body.contentPillars, 20, 100),
    brandVoice: clean(body.brandVoice, 3000), subjectsToPrioritize: clean(body.subjectsToPrioritize, 3000), subjectsToAvoid: clean(body.subjectsToAvoid, 3000),
    seoFocus: clean(body.seoFocus, 1000), targetArticleLength: Math.max(500, Math.min(2500, Number(body.targetArticleLength) || 1000)),
    preferredCallToAction: clean(body.preferredCallToAction, 1000), imagePreferences: clean(body.imagePreferences, 1000), roadmap, conflicts,
    factualConfirmations: Array.isArray(body.factualConfirmations) ? list(body.factualConfirmations, 20, 500) : [],
  };
}

export const BLOG_SERIES_PROPOSAL_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["seriesName","targetAudience","purpose","cadence","generateDaysBefore","contentPillars","brandVoice","subjectsToPrioritize","subjectsToAvoid","seoFocus","targetArticleLength","preferredCallToAction","imagePreferences","roadmap","conflicts","factualConfirmations"],
  properties: {
    seriesName:{type:"string"}, targetAudience:{type:"string"}, purpose:{type:"string"}, cadence:{type:"string",enum:["WEEKLY","BIWEEKLY","MONTHLY"]}, generateDaysBefore:{type:"integer",minimum:1,maximum:30}, contentPillars:{type:"array",items:{type:"string"},minItems:1,maxItems:20}, brandVoice:{type:"string"}, subjectsToPrioritize:{type:"string"}, subjectsToAvoid:{type:"string"}, seoFocus:{type:"string"}, targetArticleLength:{type:"integer",minimum:500,maximum:2500}, preferredCallToAction:{type:"string"}, imagePreferences:{type:"string"},
    roadmap:{type:"array",minItems:6,maxItems:12,items:{type:"object",additionalProperties:false,required:["workingTitle","primaryTopic","searchIntent","primaryKeyword","supportingKeywords","articleAngle","readerTakeaway","relevantService","internalLinks","mediaCategory","callToAction","publicationOrder"],properties:{workingTitle:{type:"string"},primaryTopic:{type:"string"},searchIntent:{type:"string"},primaryKeyword:{type:"string"},supportingKeywords:{type:"array",items:{type:"string"}},articleAngle:{type:"string"},readerTakeaway:{type:"string"},relevantService:{type:"string"},internalLinks:{type:"array",items:{type:"string"}},mediaCategory:{type:"string"},callToAction:{type:"string"},publicationOrder:{type:"integer"}}}},
    conflicts:{type:"array",items:{type:"object",additionalProperties:false,required:["conflictingContent","reason","differentiation","revisedTopic"],properties:{conflictingContent:{type:"string"},reason:{type:"string"},differentiation:{type:"string"},revisedTopic:{type:"string"}}}}, factualConfirmations:{type:"array",items:{type:"string"}},
  },
} as const;
