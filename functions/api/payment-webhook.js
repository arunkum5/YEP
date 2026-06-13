export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

    const event = body.event;
    const signature = request.headers.get("X-Razorpay-Signature");
    const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;

    // 1. Signature Verification (If Webhook Secret is defined)
    if (webhookSecret && signature) {
      // HMAC-SHA256 signature verification in Web-standards cryptography
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(webhookSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );
      
      const verified = await crypto.subtle.verify(
        "HMAC",
        key,
        hexToBytes(signature),
        encoder.encode(rawBody)
      );

      if (!verified) {
        return new Response("Invalid signature", { status: 401 });
      }
    } else if (webhookSecret) {
      return new Response("Missing signature header", { status: 400 });
    }

    // 2. Process payment success events
    if (event === "order.paid" || event === "payment.captured") {
      const paymentEntity = body.payload.payment.entity;
      const notes = paymentEntity.notes || {};

      // If webhook has valid registration notes, insert to Supabase as fallback
      if (notes.phone && notes.name && notes.aadhaar) {
      const supabaseUrl = env.SUPABASE_URL || 'https://hqaimprjdejeklrtntfz.supabase.co';
      const supabaseKey = env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxYWltcHJqZGVqZWtscnRudGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExODk5MzksImV4cCI6MjA5Njc2NTkzOX0.HgeoS1c8B0oK67PnXzr3q_nsRDLaBAB1XGRg1O0rk1I';

      if (notes.member_uuid) {
        // Update the existing pending member record to 'paid'
        const updateRes = await fetch(`${supabaseUrl}/rest/v1/members?id=eq.${encodeURIComponent(notes.member_uuid)}`, {
          method: "PATCH",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
          },
          body: JSON.stringify({
            payment_status: 'paid',
            payment_id: paymentEntity.id,
            amount_paid: paymentEntity.amount / 100 // Convert paise to INR
          })
        });

        if (updateRes.ok) {
          // Trigger WhatsApp welcome message
          const requestUrl = new URL(request.url);
          const domain = `${requestUrl.protocol}//${requestUrl.host}`;
          
          try {
            await fetch(`${domain}/api/send-whatsapp`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                phone: notes.phone,
                name: notes.name
              })
            });
          } catch (waErr) {
            console.error("Webhook failed to trigger WhatsApp message: ", waErr);
          }
        } else {
          const updateErrText = await updateRes.text();
          console.error("Webhook failed to update member payment details: ", updateErrText);
        }
      }
      // Fallback: If webhook contains full registration notes but no UUID, check and insert (old path)
      else if (notes.phone && notes.name && notes.aadhaar) {
        // Check if member already exists
        const checkRes = await fetch(`${supabaseUrl}/rest/v1/members?phone=eq.${encodeURIComponent(notes.phone)}&select=id`, {
          method: "GET",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`
          }
        });

        const checkData = await checkRes.json();

        // If member doesn't exist yet, insert them
        if (checkRes.ok && (!checkData || checkData.length === 0)) {
          const insertRes = await fetch(`${supabaseUrl}/rest/v1/members`, {
            method: "POST",
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
              "Prefer": "return=minimal"
            },
            body: JSON.stringify({
              name: notes.name,
              phone: notes.phone,
              aadhaar: notes.aadhaar,
              qualification: notes.qualification || null,
              state: notes.state || 'Karnataka',
              district: notes.district,
              taluk: notes.taluk,
              village: notes.village || null,
              photo_url: notes.photo_url,
              approved: false,
              payment_status: 'paid',
              payment_id: paymentEntity.id,
              amount_paid: paymentEntity.amount / 100
            })
          });

          if (insertRes.ok) {
            // Trigger WhatsApp welcome message
            const requestUrl = new URL(request.url);
            const domain = `${requestUrl.protocol}//${requestUrl.host}`;
            
            try {
              await fetch(`${domain}/api/send-whatsapp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  phone: notes.phone,
                  name: notes.name
                })
              });
            } catch (waErr) {
              console.error("Webhook failed to trigger WhatsApp message: ", waErr);
            }
          } else {
            const insertErrText = await insertRes.text();
            console.error("Webhook failed to insert member: ", insertErrText);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Payment webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// Helper: Convert hex string to byte array
function hexToBytes(hex) {
  const bytes = [];
  for (let c = 0; c < hex.length; c += 2) {
    bytes.push(parseInt(hex.substr(c, 2), 16));
  }
  return new Uint8Array(bytes);
}
