import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("Processing authentication...");

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");

      // Check if this is a Supabase magic link callback
      const accessToken = searchParams.get("access_token");
      const refreshToken = searchParams.get("refresh_token");

      if (accessToken && refreshToken) {
        // Handle Supabase token callback
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          toast.error("Failed to establish session");
          navigate("/auth");
          return;
        }

        toast.success("Signed in successfully!");
        navigate("/search");
        return;
      }

      if (error) {
        toast.error(errorDescription || "Authentication failed");
        navigate("/auth");
        return;
      }

      if (!code) {
        // Check for hash fragment (Supabase auth callback)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const hashAccessToken = hashParams.get("access_token");
        
        if (hashAccessToken) {
          const hashRefreshToken = hashParams.get("refresh_token");
          if (hashRefreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: hashAccessToken,
              refresh_token: hashRefreshToken,
            });

            if (!sessionError) {
              toast.success("Signed in successfully!");
              navigate("/search");
              return;
            }
          }
        }

        toast.error("No authorization code received");
        navigate("/auth");
        return;
      }

      // CSRF Protection: Verify the state parameter
      if (state) {
        const storedState = sessionStorage.getItem("oauth_state");
        
        if (!storedState) {
          console.error("CSRF verification failed: No stored state found");
          toast.error("Security verification failed. Please try again.");
          navigate("/auth");
          return;
        }

        if (state !== storedState) {
          console.error("CSRF verification failed: State mismatch");
          toast.error("Security verification failed. Please try again.");
          sessionStorage.removeItem("oauth_state");
          navigate("/auth");
          return;
        }

        // Clear the stored state after successful verification
        sessionStorage.removeItem("oauth_state");
        console.log("CSRF state verification passed");
      }

      setStatus("Verifying credentials...");

      try {
        const redirectUri = `${window.location.origin}/auth/callback`;

        const response = await supabase.functions.invoke("alsamos-oauth", {
          body: { code, redirect_uri: redirectUri },
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        // Handle the response properly - functions.invoke returns { data, error }
        if (response.error) {
          throw new Error(response.error.message || "Token exchange failed");
        }

        const data = response.data;

        if (!data.success) {
          throw new Error(data.error || "Authentication failed");
        }

        setStatus("Signing you in...");

        // Redirect to the auth URL to complete sign in
        if (data.auth_url) {
          window.location.href = data.auth_url;
        } else {
          toast.success(`Welcome, ${data.user.name || data.user.email}!`);
          navigate("/search");
        }
      } catch (err: any) {
        console.error("OAuth callback error:", err);
        toast.error(err.message || "Failed to complete authentication");
        navigate("/auth");
      }
    };

    handleCallback();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
        <p className="text-lg text-muted-foreground">{status}</p>
      </div>
    </div>
  );
};

export default AuthCallback;
