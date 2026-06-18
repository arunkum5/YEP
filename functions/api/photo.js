export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const { searchParams } = new URL(request.url);
    let filename = searchParams.get('filename');
    const url = searchParams.get('url');

    if (url) {
      // Extract filename from URL (last path segment)
      try {
        const parsedUrl = new URL(url);
        filename = parsedUrl.pathname.substring(parsedUrl.pathname.lastIndexOf('/') + 1);
      } catch (_) {
        filename = url.substring(url.lastIndexOf('/') + 1);
      }
    }

    if (!filename) {
      return new Response(JSON.stringify({ error: "Missing filename or url parameter" }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    // Attempt to read directly from the Cloudflare R2 bucket binding
    if (env.BUCKET) {
      const object = await env.BUCKET.get(filename);
      if (object) {
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Cache-Control", "public, max-age=86400");
        
        // Make sure we have a valid Content-Type
        if (!headers.get("content-type")) {
          headers.set("content-type", "image/jpeg");
        }
        
        return new Response(object.body, {
          headers: headers
        });
      }
    }

    // Fallback: If not found in the bucket, or bucket binding is missing, try proxying the URL
    if (url && url.startsWith('http')) {
      const res = await fetch(url);
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "image/jpeg";
        const imageBuffer = await res.arrayBuffer();
        return new Response(imageBuffer, {
          headers: {
            "Content-Type": contentType,
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=86400"
          }
        });
      }
    }

    return new Response(JSON.stringify({ error: "Photo not found" }), {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
