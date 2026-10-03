import { S3Client } from "@aws-sdk/client-s3";

type R2EnvironmentVariable =
  | "R2_ACCOUNT_ID"
  | "R2_ACCESS_KEY_ID"
  | "R2_SECRET_ACCESS_KEY"
  | "R2_BUCKET_NAME"
  | "R2_PUBLIC_URL";

function getRequiredEnvironmentVariable(name: R2EnvironmentVariable): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const stagingDisabled = process.env.STAGING_HOSTED_ADMISSION === "preview-only"
  && process.env.VERCEL_ENV === "preview"
  && process.env.VERCEL_PROJECT_ID === "prj_PUv0ADGxYl5QjRYaMv2h8Km1UmMg";
function disabled(): never { throw new Error("R2_DISABLED_FOR_STAGING_QUALIFICATION"); }

function configuredR2() {
 const config = {
  accountId: getRequiredEnvironmentVariable("R2_ACCOUNT_ID"),
  accessKeyId: getRequiredEnvironmentVariable("R2_ACCESS_KEY_ID"),
  secretAccessKey: getRequiredEnvironmentVariable("R2_SECRET_ACCESS_KEY"),
  bucketName: getRequiredEnvironmentVariable("R2_BUCKET_NAME"),
  publicUrl: getRequiredEnvironmentVariable("R2_PUBLIC_URL").replace(
    /\/+$/,
    "",
  ),
};

 const client = new S3Client({
  region: "auto",
  endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  },
});

 return {config, client};
}
// Never construct an SDK client or evaluate provider credentials in staging.
const configured = stagingDisabled ? null : configuredR2();
export const r2Config = configured?.config ?? new Proxy({} as ReturnType<typeof configuredR2>["config"], {get: disabled});
export const r2Client = configured?.client ?? new Proxy({} as S3Client, {get: disabled});
