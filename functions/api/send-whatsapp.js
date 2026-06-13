export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();
    const { phone, name } = body;

    if (!phone || !name) {
      return new Response(JSON.stringify({ success: false, error: "Missing phone or name" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Initialize Supabase details in function
    const supabaseUrl = env.SUPABASE_URL || 'https://hqaimprjdejeklrtntfz.supabase.co';
    const supabaseKey = env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxYWltcHJqZGVqZWtscnRudGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExODk5MzksImV4cCI6MjA5Njc2NTkzOX0.HgeoS1c8B0oK67PnXzr3q_nsRDLaBAB1XGRg1O0rk1I';

    // 1. Fetch the user's UUID (id) from Supabase matching the phone number
    const dbResponse = await fetch(`${supabaseUrl}/rest/v1/members?phone=eq.${encodeURIComponent(phone)}&select=id`, {
      method: "GET",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json"
      }
    });

    if (!dbResponse.ok) {
      const dbErrText = await dbResponse.text();
      console.error("Database query failed inside send-whatsapp API:", dbErrText);
      throw new Error("Failed to fetch member details from database.");
    }

    const dbData = await dbResponse.json();
    if (!dbData || dbData.length === 0) {
      throw new Error("Member not found in database.");
    }

    const memberUuid = dbData[0].id;
    
    // Construct the direct card download URL
    const requestUrl = new URL(request.url);
    const domain = `${requestUrl.protocol}//${requestUrl.host}`;
    const cardDownloadUrl = `${domain}/card.html?id=${memberUuid}`;

    // Construct the WhatsApp message text
    const messageText = `Hello ${name}! Welcome to the YoungSTAR Empowerment Party (YEP). Your registration is successful and payment received. Download your digital YEP Membership ID Card here: ${cardDownloadUrl}`;

    // 2. TRIGGER WHATSAPP GATEWAY
    // We support Twilio or Meta Business API templates if keys are provided. Otherwise, it logs in console (mock mode).
    const waToken = env.WHATSAPP_API_TOKEN;
    const waPhoneId = env.WHATSAPP_PHONE_NUMBER_ID; // For Meta WhatsApp Cloud API

    if (!waToken || !waPhoneId) {
      console.warn("WhatsApp API credentials missing. Logging message to console (Mock Mode):");
      console.log(`[WhatsApp to ${phone}]: ${messageText}`);
      
      return new Response(JSON.stringify({ 
        success: true, 
        mock: true, 
        message: "Logged to console successfully",
        url: cardDownloadUrl 
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Call Meta WhatsApp Cloud API
    const whatsappApiUrl = `https://graph.facebook.com/v17.0/${waPhoneId}/messages`;
    
    // Formatting standard template or custom text message (requires pre-approved templates for live numbers)
    const response = await fetch(whatsappApiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${waToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: `91${phone}`, // Assumes Indian phone number format
        type: "text",
        text: {
          preview_url: true,
          body: messageText
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`WhatsApp Gateway failure: ${response.status} - ${errText}`);
    }

    const responseData = await response.json();
    return new Response(JSON.stringify({ success: true, gateway_response: responseData }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("WhatsApp API Function error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
