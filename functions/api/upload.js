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
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Generate a unique filename using timestamp to avoid namespace collision
    const cleanFilename = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;

    // Upload to the bound Cloudflare R2 bucket (env.BUCKET)
    await env.BUCKET.put(cleanFilename, bytes.buffer, {
      httpMetadata: {
        contentType: "image/jpeg"
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
