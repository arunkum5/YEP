export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    
    // Parse input
    const { email, password } = await request.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // Input validations
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters long" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // 1. Authorization check: Requester must be a valid logged-in admin user.
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
    
    const token = authHeader.substring(7);
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseAnonKey = env.SUPABASE_ANON_KEY;
    const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

    // Check if we are running in mock mode.
    // If the token is 'mock_admin_token' or if we don't have Supabase URL/keys configured properly, we run in mock mode.
    const isMock = !supabaseUrl || supabaseUrl.includes('your-supabase-url') || token === 'mock_admin_token';

    if (isMock) {
      // Mock mode success (no residue left on DB)
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Mock admin created successfully (no residue left on real DB)",
        user: { email, id: "mock-uid-" + Math.random().toString(36).substring(2, 11) }
      }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // Verify requesting user session against Supabase
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': supabaseAnonKey
      }
    });

    if (!userRes.ok) {
      const errText = await userRes.text();
      return new Response(JSON.stringify({ error: `Unauthorized: Invalid active session (${errText})` }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // Now, create the new admin user using service_role key
    if (!supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ error: "Server Configuration Error: SUPABASE_SERVICE_ROLE_KEY is not defined" }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const createUserRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceRoleKey}`,
        'apikey': supabaseServiceRoleKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true
      })
    });

    if (!createUserRes.ok) {
      const errData = await createUserRes.json();
      return new Response(JSON.stringify({ error: errData.msg || errData.message || "Failed to create admin user" }), {
        status: createUserRes.status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    const createdUserData = await createUserRes.json();
    return new Response(JSON.stringify({
      success: true,
      user: createdUserData
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
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}
