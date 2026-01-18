import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALSAMOS_AUTH_URL = "https://accounts.alsamos.com/oauth/authorize";
const ALSAMOS_TOKEN_URL = "https://accounts.alsamos.com/oauth/token";
const ALSAMOS_USERINFO_URL = "https://accounts.alsamos.com/oauth/userinfo";

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    
    // Parse action from query params or body
    let action = url.searchParams.get("action");
    let bodyData: Record<string, string> = {};
    
    if (req.method === "POST") {
      try {
        bodyData = await req.json();
        if (bodyData.action) {
          action = bodyData.action;
        }
      } catch {
        // Body might be empty or not JSON
      }
    }

    const clientId = Deno.env.get("ALSAMOS_CLIENT_ID");
    const clientSecret = Deno.env.get("ALSAMOS_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      console.error("Missing ALSAMOS_CLIENT_ID or ALSAMOS_CLIENT_SECRET");
      return new Response(
        JSON.stringify({ error: "OAuth not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: Get authorization URL
    if (action === "authorize") {
      const redirectUri = url.searchParams.get("redirect_uri") || bodyData.redirect_uri;
      const state = url.searchParams.get("state") || bodyData.state || crypto.randomUUID();

      if (!redirectUri) {
        return new Response(
          JSON.stringify({ error: "redirect_uri is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const authUrl = new URL(ALSAMOS_AUTH_URL);
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "openid profile email");
      authUrl.searchParams.set("state", state);

      console.log("Generated authorization URL for redirect_uri:", redirectUri);

      return new Response(
        JSON.stringify({ authorization_url: authUrl.toString(), state }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: Exchange code for token
    if (action === "token") {
      const { code, redirect_uri } = bodyData;

      if (!code || !redirect_uri) {
        return new Response(
          JSON.stringify({ error: "code and redirect_uri are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Exchanging code for token...");

      // Exchange authorization code for access token
      const tokenResponse = await fetch(ALSAMOS_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("Token exchange failed:", errorText);
        return new Response(
          JSON.stringify({ error: "Token exchange failed", details: errorText }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenData = await tokenResponse.json();
      console.log("Token exchange successful");

      // Fetch user info
      const userInfoResponse = await fetch(ALSAMOS_USERINFO_URL, {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });

      if (!userInfoResponse.ok) {
        const errorText = await userInfoResponse.text();
        console.error("Failed to fetch user info:", errorText);
        return new Response(
          JSON.stringify({ error: "Failed to fetch user info", details: errorText }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const userInfo = await userInfoResponse.json();
      console.log("User info fetched:", userInfo.email);

      // Create or sign in user via Supabase Admin
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Check if user exists
      const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
      
      if (listError) {
        console.error("Error listing users:", listError);
        return new Response(
          JSON.stringify({ error: "Failed to check existing users" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const existingUser = existingUsers.users.find(u => u.email === userInfo.email);

      let userId: string;
      
      if (existingUser) {
        // User exists, use their ID
        userId = existingUser.id;
        console.log("Existing user found:", userId);
      } else {
        // Create new user
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: userInfo.email,
          email_confirm: true,
          user_metadata: {
            full_name: userInfo.name || userInfo.display_name,
            avatar_url: userInfo.avatar_url || userInfo.picture,
            alsamos_id: userInfo.sub || userInfo.id,
          },
        });

        if (createError) {
          console.error("Error creating user:", createError);
          return new Response(
            JSON.stringify({ error: "Failed to create user" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        userId = newUser.user.id;
        console.log("New user created:", userId);

        // Create profile for new user
        await supabase.from("profiles").upsert({
          id: userId,
          email: userInfo.email,
          full_name: userInfo.name || userInfo.display_name,
          display_name: userInfo.display_name || userInfo.name,
          avatar_url: userInfo.avatar_url || userInfo.picture,
        });
      }

      // Generate a session for the user
      const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: userInfo.email,
        options: {
          redirectTo: `${new URL(redirect_uri).origin}/search`,
        },
      });

      if (sessionError) {
        console.error("Error generating session link:", sessionError);
        return new Response(
          JSON.stringify({ error: "Failed to generate session" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Extract token from magic link
      const magicLink = new URL(sessionData.properties.hashed_token ? 
        `${supabaseUrl}/auth/v1/verify?token=${sessionData.properties.hashed_token}&type=magiclink` :
        sessionData.properties.action_link
      );

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: userId,
            email: userInfo.email,
            name: userInfo.name || userInfo.display_name,
            avatar_url: userInfo.avatar_url || userInfo.picture,
          },
          auth_url: sessionData.properties.action_link,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'authorize' or 'token'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("OAuth error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
