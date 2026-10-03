// Bundle-only request adapter. Never imported by the application or deployed.
import { AsyncLocalStorage } from 'node:async_hooks';
import { PrismaClient } from '../../../app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
export let prisma: PrismaClient;
export function connect(connection: ConstructorParameters<typeof PrismaPg>[0]) {
  prisma = new PrismaClient({ adapter: new PrismaPg(connection) });
  return prisma;
}
export const requestContext = new AsyncLocalStorage<{ host: string; token?: string }>();
export async function headers() { return new Headers({ host: requestContext.getStore()!.host }); }
export async function cookies() { return { get: () => requestContext.getStore()?.token ? { value: requestContext.getStore()!.token } : undefined }; }
export function revalidatePath() { /* No Next cache exists in this service harness. */ }
export function redirect() { throw new Error('HARNESS_REDIRECT'); }
