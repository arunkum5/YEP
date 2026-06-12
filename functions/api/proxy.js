export async function onRequestGet(context) {
  try {
    const { request } = context;
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "Missing url parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Fetch the image from the destination URL
    const res = await fetch(imageUrl);

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Failed to fetch image: Status ${res.status}` }), {
        status: res.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const imageBuffer = await res.arrayBuffer();

    return new Response(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
