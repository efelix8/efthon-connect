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

async function handleGet(req: Request): Promise<Response> {
  const supabase = createSupabaseClient(req);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const roomSlug = url.searchParams.get("room");
  const limitParam = url.searchParams.get("limit");
  const beforeParam = url.searchParams.get("before");

  if (!roomSlug) {
    return jsonResponse({ error: "Missing room parameter" }, { status: 400 });
  }

  const limit = Math.min(Math.max(Number(limitParam) || 50, 1), 100);

  const {
    data: room,
    error: roomError,
  } = await supabase
    .from("rooms")
    .select("id, slug, name")
    .eq("slug", roomSlug)
    .maybeSingle();

  if (roomError) {
    console.error("Error selecting room", roomError);
    return jsonResponse({ error: "Failed to fetch room" }, { status: 500 });
  }

  if (!room) {
    return jsonResponse({ error: "Room not found" }, { status: 404 });
  }

  let query = supabase
    .from("messages")
    .select(
      `id, content, created_at, edited_at, room_id,
       user:users ( id, nickname )`
    )
    .eq("room_id", room.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (beforeParam) {
    query = query.lt("created_at", beforeParam);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error selecting messages", error);
    return jsonResponse({ error: "Failed to fetch messages" }, { status: 500 });
  }

  const messages = (data ?? []).map((m) => ({
    id: m.id,
    content: m.content,
    createdAt: m.created_at,
    editedAt: m.edited_at,
    roomId: m.room_id,
    user: m.user,
  }));

  return jsonResponse({ room, messages });
}

async function handlePost(req: Request): Promise<Response> {
  const supabase = createSupabaseClient(req);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as
    | { room?: string; content?: string }
    | null;

  const roomSlug = body?.room?.trim();
  const rawContent = body?.content ?? "";
  const content = rawContent.trim();

  if (!roomSlug) {
    return jsonResponse({ error: "Room is required" }, { status: 400 });
  }

  if (!content) {
    return jsonResponse({ error: "Content is required" }, { status: 400 });
  }

  if (content.length > 500) {
    return jsonResponse({ error: "Content must be at most 500 characters" }, { status: 400 });
  }

  const {
    data: room,
    error: roomError,
  } = await supabase
    .from("rooms")
    .select("id, slug, name")
    .eq("slug", roomSlug)
    .maybeSingle();

  if (roomError) {
    console.error("Error selecting room", roomError);
    return jsonResponse({ error: "Failed to fetch room" }, { status: 500 });
  }

  if (!room) {
    return jsonResponse({ error: "Room not found" }, { status: 404 });
  }

  const {
    data: chatUser,
    error: userRowError,
  } = await supabase
    .from("users")
    .select("id, nickname")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (userRowError) {
    console.error("Error selecting users row", userRowError);
    return jsonResponse({ error: "Failed to fetch user mapping" }, { status: 500 });
  }

  if (!chatUser) {
    return jsonResponse({ error: "User mapping not found. Call /api/auth/nickname first." }, { status: 400 });
  }

  const {
    data: inserted,
    error: insertError,
  } = await supabase
    .from("messages")
    .insert({
      room_id: room.id,
      user_id: chatUser.id,
      content,
    })
    .select("id, content, created_at, edited_at, room_id")
    .single();

  if (insertError) {
    console.error("Error inserting message", insertError);
    return jsonResponse({ error: "Failed to create message" }, { status: 500 });
  }

  const message = {
    id: inserted.id,
    content: inserted.content,
    createdAt: inserted.created_at,
    editedAt: inserted.edited_at,
    roomId: inserted.room_id,
    user: chatUser,
  };

  return jsonResponse({ room, message });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method === "GET") {
      return await handleGet(req);
    }

    if (req.method === "POST") {
      return await handlePost(req);
    }

    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  } catch (error) {
    console.error("Error in messages function", error);
    return jsonResponse({ error: "Internal server error" }, { status: 500 });
  }
});
