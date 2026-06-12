export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    
    // Parse the base64 image and filename
    const { filename, image } = await request.json();
    
    if (!image) {
      return new Response(JSON.stringify({ error: "No image data provided" }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    // Convert base64 data URL to ArrayBuffer
    const base64Data = image.split(',')[1] || image;
    
    // Strict size check on the base64 string before allocating a binary buffer (2MB binary is ~2.7MB base64)
    const maxBase64Length = 3 * 1024 * 1024;
    if (base64Data.length > maxBase64Length) {
      return new Response(JSON.stringify({ error: "Uploaded photo exceeds the 2MB size limit." }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    let binaryString;
    try {
      binaryString = atob(base64Data);
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid base64 photo data format." }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    const len = binaryString.length;
    // Strict size check on the decoded binary data (2MB max limit)
    if (len > 2 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "Uploaded photo exceeds the 2MB size limit." }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Inspect magic bytes (file signature) to verify format and set mime type
    let detectedMimeType = null;
    let extension = null;

    if (len >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      detectedMimeType = "image/jpeg";
      extension = "jpg";
    } else if (len >= 8 &&
               bytes[0] === 0x89 &&
               bytes[1] === 0x50 &&
               bytes[2] === 0x4E &&
               bytes[3] === 0x47 &&
               bytes[4] === 0x0D &&
               bytes[5] === 0x0A &&
               bytes[6] === 0x1A &&
               bytes[7] === 0x0A) {
      detectedMimeType = "image/png";
      extension = "png";
    }

    if (!detectedMimeType) {
      return new Response(JSON.stringify({ error: "Invalid photo format. Only JPEG/JPG and PNG images are allowed." }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    // Strip original extension from filename and append correct one
    const baseName = filename.replace(/\.[^/.]+$/, "");
    const cleanFilename = `${baseName.replace(/[^a-zA-Z0-9.\-_]/g, '_')}.${extension}`;

    // Upload to the bound Cloudflare R2 bucket (env.BUCKET)
    await env.BUCKET.put(cleanFilename, bytes.buffer, {
      httpMetadata: {
        contentType: detectedMimeType
      }
    });

    // Public Development URL prefix for the R2 bucket (uses environment variable if defined, otherwise falls back)
    const R2_PUBLIC_URL = env.R2_PUBLIC_URL || "https://pub-3525e3b961a54cb992d074fd3b03afb9.r2.dev";
    const publicUrl = `${R2_PUBLIC_URL}/${cleanFilename}`;

    const secret = env.JWT_SECRET || 'yep_secure_photo_signature_key_2026';
    const signature = await generateSignature(cleanFilename, secret);

    return new Response(JSON.stringify({ 
      success: true, 
      photo_url: publicUrl,
      signature: signature
    }), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}

// Handle preflight options requests for CORS compatibility
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

// Helper to generate a validation signature for client-side delete requests
async function generateSignature(filename, secret) {
  const encoder = new TextEncoder();
  const data = encoder.encode(filename + secret);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Handle image deletion from the R2 bucket
export async function onRequestDelete(context) {
  try {
    const { request, env } = context;
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');
    const signature = searchParams.get('signature');

    if (!filename) {
      return new Response(JSON.stringify({ error: "No filename provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    let isAuthorized = false;
    const secret = env.JWT_SECRET || 'yep_secure_photo_signature_key_2026';

    // 1. Check for valid client signature (used by registration form cleanup)
    if (signature) {
      const expectedSignature = await generateSignature(filename, secret);
      if (signature === expectedSignature) {
        isAuthorized = true;
      }
    }

    // 2. Check for active Supabase Admin Authorization token (used by admin dashboard)
    if (!isAuthorized) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const supabaseUrl = env.SUPABASE_URL || 'https://hqaimprjdejeklrtntfz.supabase.co';
        const supabaseAnonKey = env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxYWltcHJqZGVqZWtscnRudGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExODk5MzksImV4cCI6MjA5Njc2NTkzOX0.HgeoS1c8B0oK67PnXzr3q_nsRDLaBAB1XGRg1O0rk1I';

        try {
          const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'apikey': supabaseAnonKey
            }
          });
          if (userRes.ok) {
            isAuthorized = true;
          }
        } catch (err) {
          console.error("Supabase user verification failed:", err);
        }
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid signature or session token" }), {
        status: 401,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    // Delete the file from the R2 bucket
    await env.BUCKET.delete(filename);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
