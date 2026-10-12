import "server-only";

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/csv",
]);

const MAX_BYTES = 10 * 1024 * 1024;

export function assertAttachment(file: { size: number; type: string }) {
  if (file.size <= 0 || file.size > MAX_BYTES) {
    throw new Error("FILE_TOO_LARGE");
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("FILE_TYPE");
  }
}

function localFile(key: string) {
  return path.join(process.cwd(), "uploads", key);
}

function assertKey(key: string) {
  if (key.includes("..") || path.isAbsolute(key)) {
    throw new Error("FILE_KEY");
  }
}

function s3() {
  return new S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
  });
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  assertKey(key);
  if (process.env.STORAGE_DRIVER === "s3") {
    await s3().send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return;
  }
  const full = localFile(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, body);
}

export async function getObject(key: string) {
  assertKey(key);
  if (process.env.STORAGE_DRIVER === "s3") {
    const response = await s3().send(
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
    );
    const bytes = await response.Body?.transformToByteArray();
    if (!bytes) {
      throw new Error("FILE_MISSING");
    }
    return Buffer.from(bytes);
  }
  return readFile(localFile(key));
}
