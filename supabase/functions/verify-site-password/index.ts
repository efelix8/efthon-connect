import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password } = await req.json();
    
    // Multiple valid passwords
    const validPasswords = [
      "enesabipardon",
      "zeynepidigü",
      "sinangür",
      "elifnalbantoğlu",
    ];
    
    // Also check the environment variable password if set
    const envPassword = Deno.env.get("SITE_ACCESS_PASSWORD");
    if (envPassword) {
      validPasswords.push(envPassword);
    }

    const isValid = validPasswords.includes(password);
    console.log(`Password verification attempt: ${isValid ? "success" : "failed"}`);

    return new Response(
      JSON.stringify({ valid: isValid }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error verifying password:", error);
    return new Response(
      JSON.stringify({ error: "Invalid request" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
