import {studioTeamPaySchedule} from "@/lib/team-pay-schedule-service";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=30;
export function POST(request:Request){return studioTeamPaySchedule(request);}
