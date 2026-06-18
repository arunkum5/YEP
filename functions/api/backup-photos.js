/**
 * /api/backup-photos
 * Downloads all files from the R2 BUCKET binding as a .zip archive.
 * The archive root folder is named with a UTC timestamp (backup_YYYY-MM-DD_HH-MM-SS).
 * Original filenames are preserved exactly as stored in R2.
 *
 * Requires:  env.BUCKET   (R2 bucket binding)
 * Auth:      Bearer token validated against Supabase /auth/v1/user
 */

// ─── Minimal ZIP builder (DEFLATE-store, no compression) ────────────────────
// We write a store-only (method=0) ZIP so we don't need a compression library.

function u16le(n) {
  return [(n & 0xff), (n >> 8) & 0xff];
}
function u32le(n) {
  const buf = new Uint8Array(4);
  buf[0] = n & 0xff;
  buf[1] = (n >> 8) & 0xff;
  buf[2] = (n >> 16) & 0xff;
  buf[3] = (n >> 24) & 0xff;
  return buf;
}

/** CRC-32 table */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(data) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encodeUTF8(str) {
  return new TextEncoder().encode(str);
}

/**
 * Build a complete ZIP Uint8Array from an array of { name, data } entries.
 * name  – full path inside the zip (e.g. "folder/photo.jpg")
 * data  – Uint8Array of file bytes
 */
function buildZip(entries) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encodeUTF8(entry.name);
    const data = entry.data; // Uint8Array
    const crc = crc32(data);
    const size = data.length;

    // Local file header
    const localHeader = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04,       // signature
      20, 0,                          // version needed (2.0)
      0, 0x08,                        // general purpose bit flag (UTF-8)
      0, 0,                           // compression method = store
      0, 0, 0, 0,                     // last mod time/date (zero)
      ...u32le(crc),                  // CRC-32
      ...u32le(size),                 // compressed size
      ...u32le(size),                 // uncompressed size
      ...u16le(nameBytes.length),     // filename length
      0, 0,                           // extra field length
      ...nameBytes,                   // filename
    ]);

    localHeaders.push({ header: localHeader, data });

    // Central directory entry
    const centralHeader = new Uint8Array([
      0x50, 0x4b, 0x01, 0x02,       // signature
      20, 0,                          // version made by
      20, 0,                          // version needed
      0, 0x08,                        // general purpose bit flag
      0, 0,                           // compression method
      0, 0, 0, 0,                     // last mod time/date
      ...u32le(crc),
      ...u32le(size),
      ...u32le(size),
      ...u16le(nameBytes.length),
      0, 0,                           // extra field length
      0, 0,                           // file comment length
      0, 0,                           // disk number start
      0, 0,                           // internal attributes
      0, 0, 0, 0,                     // external attributes
      ...u32le(offset),               // relative offset of local header
      ...nameBytes,
    ]);

    centralHeaders.push(centralHeader);
    offset += localHeader.length + size;
  }

  const centralDirOffset = offset;
  const centralDirSize = centralHeaders.reduce((s, h) => s + h.length, 0);

  // End of central directory record
  const eocd = new Uint8Array([
    0x50, 0x4b, 0x05, 0x06,           // signature
    0, 0,                              // disk number
    0, 0,                              // disk with central dir
    ...u16le(entries.length),          // total entries on disk
    ...u16le(entries.length),          // total entries
    ...u32le(centralDirSize),          // central dir size
    ...u32le(centralDirOffset),        // central dir offset
    0, 0,                              // comment length
  ]);

  // Assemble
  const totalSize =
    localHeaders.reduce((s, e) => s + e.header.length + e.data.length, 0) +
    centralDirSize +
    eocd.length;

  const zip = new Uint8Array(totalSize);
  let pos = 0;

  for (const { header, data } of localHeaders) {
    zip.set(header, pos); pos += header.length;
    zip.set(data, pos);   pos += data.length;
  }
  for (const h of centralHeaders) {
    zip.set(h, pos); pos += h.length;
  }
  zip.set(eocd, pos);

  return zip;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function onRequestGet(context) {
  const { request, env } = context;

  // 1. Verify Authorization
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Missing token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const token = authHeader.substring(7);
  const supabaseUrl = env.SUPABASE_URL || 'https://hqaimprjdejeklrtntfz.supabase.co';
  const supabaseAnonKey = env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxYWltcHJqZGVqZWtscnRudGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExODk5MzksImV4cCI6MjA5Njc2NTkzOX0.HgeoS1c8B0oK67PnXzr3q_nsRDLaBAB1XGRg1O0rk1I';

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': supabaseAnonKey },
  });

  if (!userRes.ok) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Invalid session token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // 2. Check bucket binding
  if (!env.BUCKET) {
    return new Response(JSON.stringify({ error: 'R2 bucket binding BUCKET is not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // 3. Build timestamp folder name  e.g.  backup_2026-06-18_10-30-00
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const folderName =
    `backup_${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}` +
    `_${pad(now.getUTCHours())}-${pad(now.getUTCMinutes())}-${pad(now.getUTCSeconds())}`;

  // 4. List all objects in R2 (paginate)
  const allObjects = [];
  let truncated = true;
  let cursor = undefined;

  while (truncated) {
    const opts = { limit: 1000 };
    if (cursor) opts.cursor = cursor;
    const listResult = await env.BUCKET.list(opts);
    allObjects.push(...listResult.objects);
    truncated = listResult.truncated;
    if (truncated) cursor = listResult.cursor;
  }

  if (allObjects.length === 0) {
    return new Response(JSON.stringify({ error: 'No files found in R2 bucket.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // 5. Fetch each object and add to zip entries
  const entries = [];

  await Promise.all(
    allObjects.map(async (obj) => {
      try {
        const r2Obj = await env.BUCKET.get(obj.key);
        if (!r2Obj) return;
        const arrayBuffer = await r2Obj.arrayBuffer();
        entries.push({
          name: `${folderName}/${obj.key}`,   // retain original filename
          data: new Uint8Array(arrayBuffer),
        });
      } catch (_) {
        // skip files that fail to fetch
      }
    })
  );

  if (entries.length === 0) {
    return new Response(JSON.stringify({ error: 'Failed to read any files from R2.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // 6. Build zip
  const zipBytes = buildZip(entries);

  return new Response(zipBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${folderName}.zip"`,
      'Content-Length': String(zipBytes.length),
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
