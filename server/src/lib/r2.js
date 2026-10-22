// ─── Cloudflare R2 client (S3-compatible) ────────────────────────────────────
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET = 'vpred-music',
} = process.env;

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export const BUCKET = R2_BUCKET;

// Upload a Buffer to R2, returns the object key
export async function uploadToR2(key, buffer, contentType = 'audio/mpeg') {
  await r2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  return key;
}

// Stream an object from R2, returns a Node.js Readable stream
export async function streamFromR2(key) {
  const res = await r2.send(new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
  return res; // res.Body is a Readable, res.ContentLength available
}

// Delete an object from R2
export async function deleteFromR2(key) {
  await r2.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
}
