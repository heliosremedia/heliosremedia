import {inventoryVercel} from './access-provenance.mjs';
// Explicit read-only invocation, no dotenv and no fallback to production credentials.
const result=await inventoryVercel({token:process.env.HELIOS_READONLY_VERCEL_TOKEN,teamId:process.env.HELIOS_INVENTORY_TEAM_ID});
console.log(JSON.stringify(result));
process.exitCode=result.deployable?0:2;
