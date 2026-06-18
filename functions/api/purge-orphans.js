export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    // 1. Verify Authorization (Supabase Admin Session)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const token = authHeader.substring(7);
    const supabaseUrl = env.SUPABASE_URL || 'https://hqaimprjdejeklrtntfz.supabase.co';
    const supabaseAnonKey = env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxYWltcHJqZGVqZWtscnRudGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExODk5MzksImV4cCI6MjA5Njc2NTkzOX0.HgeoS1c8B0oK67PnXzr3q_nsRDLaBAB1XGRg1O0rk1I';

    // Verify token validity by calling Supabase user info endpoint
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': supabaseAnonKey
      }
    });

    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid session token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // 2. Fetch all photo URLs from Supabase
    const membersRes = await fetch(`${supabaseUrl}/rest/v1/members?select=photo_url`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${token}`
      }
    });

    if (!membersRes.ok) {
      const errText = await membersRes.text();
      return new Response(JSON.stringify({ error: `Failed to fetch members: ${errText}` }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const members = await membersRes.json();
    
    // Extract filenames from Supabase photo_urls
    const activeFilenames = new Set();
    members.forEach(m => {
      if (m.photo_url) {
        try {
          const filename = m.photo_url.substring(m.photo_url.lastIndexOf('/') + 1);
          if (filename) activeFilenames.add(filename);
        } catch (_) {}
      }
    });

    // 3. List all files in the R2 bucket and delete orphans
    if (!env.BUCKET) {
      return new Response(JSON.stringify({ error: "R2 bucket binding BUCKET is not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    let truncated = true;
    let cursor = undefined;
    const deletedFiles = [];
    const activeFilesCount = [];

    while (truncated) {
      const options = { limit: 500 };
      if (cursor) {
        options.cursor = cursor;
      }

      const listResult = await env.BUCKET.list(options);
      
      for (const object of listResult.objects) {
        const key = object.key;
        
        // Skip common asset filenames if they are placed in the bucket
        if (key === 'leader_profile.jpg' || key === 'yep_leader_seal.png' || key === 'advocate_logo.svg' || key === 'logo.png') {
          activeFilesCount.push(key);
          continue;
        }

        // If the file is not found in the active member photo list, delete it!
        if (!activeFilenames.has(key)) {
          await env.BUCKET.delete(key);
          deletedFiles.push(key);
        } else {
          activeFilesCount.push(key);
        }
      }

      truncated = listResult.truncated;
      if (truncated) {
        cursor = listResult.cursor;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      deleted_count: deletedFiles.length,
      deleted_files: deletedFiles,
      active_count: activeFilesCount.length
    }), {
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

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}
