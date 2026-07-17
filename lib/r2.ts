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

export const r2Config = {
  accountId: getRequiredEnvironmentVariable("R2_ACCOUNT_ID"),
  accessKeyId: getRequiredEnvironmentVariable("R2_ACCESS_KEY_ID"),
  secretAccessKey: getRequiredEnvironmentVariable("R2_SECRET_ACCESS_KEY"),
  bucketName: getRequiredEnvironmentVariable("R2_BUCKET_NAME"),
  publicUrl: getRequiredEnvironmentVariable("R2_PUBLIC_URL").replace(
    /\/+$/,
    "",
  ),
};

export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${r2Config.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: r2Config.accessKeyId,
    secretAccessKey: r2Config.secretAccessKey,
  },
});
