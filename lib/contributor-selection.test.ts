import assert from "node:assert/strict";
import test from "node:test";
import { filterContributorUsers } from "./contributor-selection.ts";

const users = [
  { id:"jake",displayName:"Jake Guerin",title:"Owner/Photographer",firstName:"Jake",lastName:"Guerin",email:"jake@example.com",disciplines:["PHOTOGRAPHER"] },
  { id:"alex",displayName:"Alex Doe",title:"Editor",firstName:"Alex",lastName:"Doe",email:"alex@example.com",disciplines:["EDITOR"] },
];

test("contributor search matches separate titles and removes selected users",()=>{
  assert.deepEqual(filterContributorUsers(users,[],"owner").map(user=>user.id),["jake"]);
  assert.deepEqual(filterContributorUsers(users,["jake"],"").map(user=>user.id),["alex"]);
});
