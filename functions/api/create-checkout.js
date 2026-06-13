export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();
    const { amount, currency, phone, name } = body;

    // Validate inputs
    if (!amount || !currency) {
      return new Response(JSON.stringify({ success: false, error: "Missing amount or currency" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const keyId = env.RAZORPAY_KEY_ID;
    const keySecret = env.RAZORPAY_KEY_SECRET;

    // MOCK MODE FALLBACK (if environment keys are missing)
    if (!keyId || !keySecret) {
      console.warn("Razorpay API credentials not defined. Initialising in Demo/Mock mode.");
      
      const mockOrder = {
        id: `order_mock_${Math.random().toString(36).substring(2, 11)}`,
        entity: "order",
        amount: amount * 100, // in paise
        amount_paid: 0,
        amount_due: amount * 100,
        currency: currency,
        receipt: `receipt_${Date.now()}`,
        status: "created",
        attempts: 0,
        created_at: Math.floor(Date.now() / 1000)
      };

      return new Response(JSON.stringify({
        success: true,
        mock: true,
        key_id: "rzp_test_mockKey123",
        order: mockOrder
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // LIVE MODE (call Razorpay Orders API)
    const authString = btoa(`${keyId}:${keySecret}`);
    const receiptId = `receipt_${phone.replace(/\D/g, '')}_${Date.now()}`;
    const notes = body.notes || {};

    const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${authString}`
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // in paise (e.g. ₹99 = 9900 paise)
        currency: currency,
        receipt: receiptId,
        payment_capture: 1,
        notes: notes
      })
    });

    if (!razorpayResponse.ok) {
      const errorText = await razorpayResponse.text();
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Razorpay API failure: Status ${razorpayResponse.status} - ${errorText}` 
      }), {
        status: 502,
        headers: { "Content-Type": "application/json" }
      });
    }

    const orderData = await razorpayResponse.json();

    return new Response(JSON.stringify({
      success: true,
      key_id: keyId,
      order: orderData
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
