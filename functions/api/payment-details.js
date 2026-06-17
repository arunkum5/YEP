export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();
    const { phone } = body;

    if (!phone) {
      return new Response(JSON.stringify({ success: false, error: "Missing phone number" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Load UPI details from Cloudflare environment variables or fallbacks
    const upiId = env.UPI_VPA || "yepkarnataka@ybl";
    const partyName = env.UPI_PARTY_NAME || "YoungSTAR Empowerment Party";
    
    // Resolve membership fee dynamically from Supabase if possible
    let membershipFee = 1000;
    try {
      const supabaseUrl = env.SUPABASE_URL || 'https://hqaimprjdejeklrtntfz.supabase.co';
      const supabaseKey = env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxYWltcHJqZGVqZWtscnRudGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExODk5MzksImV4cCI6MjA5Njc2NTkzOX0.HgeoS1c8B0oK67PnXzr3q_nsRDLaBAB1XGRg1O0rk1I';
      const dbResponse = await fetch(`${supabaseUrl}/rest/v1/app_settings?key=eq.membership_fee&select=value`, {
        method: "GET",
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json"
        }
      });
      if (dbResponse.ok) {
        const dbData = await dbResponse.json();
        if (dbData && dbData.length > 0) {
          membershipFee = parseInt(dbData[0].value, 10) || 1000;
        }
      }
    } catch (dbErr) {
      console.error("Failed to fetch fee from Supabase in payment-details API:", dbErr);
    }

    // Construct UPI pay URL and dynamic QR code image URL
    const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(partyName)}&am=${membershipFee}&cu=INR&tn=${encodeURIComponent("YEP Membership " + phone)}`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiUrl)}`;

    return new Response(JSON.stringify({
      success: true,
      upi_url: upiUrl,
      qr_image_url: qrImageUrl,
      amount: membershipFee
    }), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
