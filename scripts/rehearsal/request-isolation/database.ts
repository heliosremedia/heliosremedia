import { PrismaClient } from "../../../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { requireDatabase } from "./safety.mjs";

// Driver and imported application workers share the same fixed disposable transport.
export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: requireDatabase(process.env.PACKET19_DATABASE_URL) }) });
