export async function onRequestPost(context) {
  try {
    const { env } = context;
    const supabaseUrl = env.SUPABASE_URL || 'https://hqaimprjdejeklrtntfz.supabase.co';
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseKey) {
      return new Response(JSON.stringify({ error: "Server Configuration Error: SUPABASE_SERVICE_ROLE_KEY is not defined" }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // 1. Delete hardcoded test phone numbers
    const deleteHardcodedRes = await fetch(`${supabaseUrl}/rest/v1/members?phone=in.(9448610199,9448610190,9448610198)`, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    // 2. Delete randomized test phone numbers (starting with 9000, 9001, 9002)
    const prefixes = ['9000', '9001', '9002'];
    const results = [];

    for (const prefix of prefixes) {
      const deleteRes = await fetch(`${supabaseUrl}/rest/v1/members?phone=like.${prefix}%`, {
        method: 'DELETE',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });
      results.push({ prefix, status: deleteRes.status });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Database test residues cleaned up successfully.",
      hardcoded_status: deleteHardcodedRes.status,
      prefix_results: results
    }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}

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
