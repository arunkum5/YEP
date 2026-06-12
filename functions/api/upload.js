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
    const cleanFilename = `${Date.now()}_${baseName.replace(/[^a-zA-Z0-9.\-_]/g, '_')}.${extension}`;

    // Upload to the bound Cloudflare R2 bucket (env.BUCKET)
    await env.BUCKET.put(cleanFilename, bytes.buffer, {
      httpMetadata: {
        contentType: detectedMimeType
      }
    });

    // Public Development URL prefix for the R2 bucket
    const R2_PUBLIC_URL = "https://pub-3525e3b961a54cb992d074fd3b03afb9.r2.dev";
    const publicUrl = `${R2_PUBLIC_URL}/${cleanFilename}`;

    return new Response(JSON.stringify({ 
      success: true, 
      photo_url: publicUrl 
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
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
