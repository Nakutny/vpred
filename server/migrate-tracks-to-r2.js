#!/usr/bin/env node
// ─── migrate-tracks-to-r2.js ──────────────────────────────────────────────────
// One-time migration: reads base64 audio_data from music_tracks,
// uploads each to Cloudflare R2, and writes the R2 key back to audio_url.
//
// Run AFTER deploying patch46 and executing fix-music-r2-migration.sql:
//   node migrate-tracks-to-r2.js
//
// Safe to re-run: skips any row that already has audio_url set.
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import pg from 'pg';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const { Pool } = pg;

// ── DB ────────────────────────────────────────────────────────────────────────
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── R2 ────────────────────────────────────────────────────────────────────────
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const BUCKET = process.env.R2_BUCKET || 'vpred-music';

function safeFilename(title) {
  return (title || 'track').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const { rows } = await pool.query(
    `SELECT id, title, audio_data, mime_type, created_at
     FROM music_tracks
     WHERE audio_data IS NOT NULL
       AND audio_url IS NULL
       AND deleted_at IS NULL
     ORDER BY created_at ASC`
  );

  if (rows.length === 0) {
    console.log('✅ No tracks to migrate.');
    await pool.end();
    return;
  }

  console.log(`Found ${rows.length} track(s) to migrate…\n`);

  for (const track of rows) {
    const key = `tracks/${new Date(track.created_at).getTime()}_${safeFilename(track.title)}.mp3`;
    const mimeType = track.mime_type || 'audio/mpeg';

    try {
      // Decode base64 → Buffer
      const buffer = Buffer.from(track.audio_data, 'base64');

      // Upload to R2
      await r2.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }));

      // Write key back to DB
      await pool.query(
        `UPDATE music_tracks SET audio_url = $1 WHERE id = $2`,
        [key, track.id]
      );

      console.log(`  ✅  [${track.id}] "${track.title}" → ${key}`);
    } catch (err) {
      console.error(`  ❌  [${track.id}] "${track.title}" FAILED:`, err.message);
      // Don't abort — continue with remaining tracks
    }
  }

  console.log('\nMigration complete.');
  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
