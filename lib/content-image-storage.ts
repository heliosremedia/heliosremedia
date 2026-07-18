import { DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

import { r2Client, r2Config } from "@/lib/r2";

export async function verifyContentImage(key: string | null) {
  if (!key) return;
  await r2Client.send(new HeadObjectCommand({ Bucket: r2Config.bucketName, Key: key }));
}

export async function deleteContentImage(key: string | null) {
  if (!key) return false;
  try {
    await r2Client.send(new DeleteObjectCommand({ Bucket: r2Config.bucketName, Key: key }));
    return false;
  } catch (error) {
    console.error("Unable to remove managed content image from R2:", error);
    return true;
  }
}
