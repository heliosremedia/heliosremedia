import assert from "node:assert/strict";
import test from "node:test";
import { consentActionForStatus } from "./client-communications/consent-action.ts";
test("unknown and pending company consent require the explicit confirmation flow",()=>{for(const status of ["UNKNOWN","PENDING_CONFIRMATION"])assert.equal(consentActionForStatus(status,true),"resubscribe");});
test("legacy unknown keeps unsubscribe and existing opt-outs keep confirmation",()=>{assert.equal(consentActionForStatus("UNKNOWN",false),"unsubscribe");for(const company of [true,false]){for(const status of ["UNSUBSCRIBED","SUPPRESSED"])assert.equal(consentActionForStatus(status,company),"resubscribe");assert.equal(consentActionForStatus("SUBSCRIBED",company),"unsubscribe");}});
