import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables");
}

function createSupabaseClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get("Authorization") ?? "";

  return createClient(supabaseUrl!, supabaseAnonKey!, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = {
    ...corsHeaders,
    "Content-Type": "application/json",
    ...(init.headers ?? {}),
  } as HeadersInit;

  return new Response(JSON.stringify(body), { ...init, headers });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const supabase = createSupabaseClient(req);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("rooms")
      .select("id, slug, name, is_default, created_at")
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });

    if (error) {
      console.error("Error selecting rooms", error);
      return jsonResponse({ error: "Failed to fetch rooms" }, { status: 500 });
    }

    return jsonResponse({ rooms: data ?? [] });
  } catch (error) {
    console.error("Error in rooms function", error);
    return jsonResponse({ error: "Internal server error" }, { status: 500 });
  }
});
