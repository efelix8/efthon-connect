import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
}

function createServiceClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get("Authorization") ?? "";

  return createClient(supabaseUrl!, serviceRoleKey!, {
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

async function handlePost(req: Request): Promise<Response> {
  const supabase = createServiceClient(req);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  const authUserId = user.id;

  const {
    data: chatUsers,
    error: chatUsersError,
  } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", authUserId);

  if (chatUsersError) {
    console.error("Error selecting users for cleanup", chatUsersError);
    return jsonResponse({ error: "Failed to prepare cleanup" }, { status: 500 });
  }

  const userIds = (chatUsers ?? []).map((u) => u.id);

  if (userIds.length > 0) {
    const { error: deleteMessagesError } = await supabase
      .from("messages")
      .delete()
      .in("user_id", userIds);

    if (deleteMessagesError) {
      console.error("Error deleting messages during cleanup", deleteMessagesError);
      return jsonResponse({ error: "Failed to delete messages" }, { status: 500 });
    }
  }

  const { error: deleteUsersError } = await supabase
    .from("users")
    .delete()
    .eq("auth_user_id", authUserId);

  if (deleteUsersError) {
    console.error("Error deleting user rows during cleanup", deleteUsersError);
    return jsonResponse({ error: "Failed to delete user rows" }, { status: 500 });
  }

  const { error: deleteProfileError } = await supabase
    .from("profiles")
    .delete()
    .eq("id", authUserId);

  if (deleteProfileError) {
    console.error("Error deleting profile during cleanup", deleteProfileError);
    return jsonResponse({ error: "Failed to delete profile" }, { status: 500 });
  }

  return jsonResponse({ success: true });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method === "POST") {
      return await handlePost(req);
    }

    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  } catch (error) {
    console.error("Error in cleanup function", error);
    return jsonResponse({ error: "Internal server error" }, { status: 500 });
  }
});
