export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { phone, utr } = await request.json();

    if (!phone || !utr) {
      return new Response(JSON.stringify({ success: false, error: 'Missing phone or UTR' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Normalize: strip non-digits
    const cleanPhone = String(phone).replace(/\D/g, '');
    const cleanUtr   = String(utr).trim();

    if (!/^\d{8,20}$/.test(cleanUtr)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid UTR format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const supabaseUrl     = env.SUPABASE_URL || 'https://hqaimprjdejeklrtntfz.supabase.co';
    const serviceRoleKey  = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return new Response(JSON.stringify({ success: false, error: 'Server config error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Use service role key — bypasses RLS, works on all clients
    const res = await fetch(
      `${supabaseUrl}/rest/v1/members?phone=eq.${encodeURIComponent(cleanPhone)}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ payment_id: cleanUtr })
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ success: false, error: errText }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const updated = await res.json();
    if (!updated || updated.length === 0) {
      return new Response(JSON.stringify({ success: false, error: `No member found for phone: ${cleanPhone}` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}
