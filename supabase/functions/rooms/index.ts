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

const MAX_ROOMS = 10;

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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
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

  const { data, error } = await supabase
    .from("rooms")
    .select("id, slug, name, is_default, created_at, created_by, password_hash")
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    console.error("Error selecting rooms", error);
    return jsonResponse({ error: "Failed to fetch rooms" }, { status: 500 });
  }

  // Transform data to not expose password_hash, just indicate if password exists
  const rooms = (data ?? []).map(room => ({
    id: room.id,
    slug: room.slug,
    name: room.name,
    is_default: room.is_default,
    created_at: room.created_at,
    created_by: room.created_by,
    has_password: !!room.password_hash,
  }));

  return jsonResponse({ rooms });
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

  const body = await req.json().catch(() => null) as { name?: string } | null;
  const rawName = body?.name ?? "";
  const name = rawName.trim();

  if (!name) {
    return jsonResponse({ error: "Room name is required" }, { status: 400 });
  }

  if (name.length < 2 || name.length > 50) {
    return jsonResponse({ error: "Room name must be between 2 and 50 characters" }, { status: 400 });
  }

  // Check room count limit
  const { count, error: countError } = await supabase
    .from("rooms")
    .select("*", { count: "exact", head: true });

  if (countError) {
    console.error("Error counting rooms", countError);
    return jsonResponse({ error: "Failed to check room limit" }, { status: 500 });
  }

  if ((count ?? 0) >= MAX_ROOMS) {
    return jsonResponse({ error: `Maximum ${MAX_ROOMS} rooms allowed` }, { status: 400 });
  }

  // Get chat user
  const {
    data: chatUser,
    error: chatUserError,
  } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (chatUserError || !chatUser) {
    console.error("Error fetching chat user", chatUserError);
    return jsonResponse({ error: "User not found. Set your nickname first." }, { status: 400 });
  }

  // Generate unique slug
  let slug = slugify(name);
  const { data: existing } = await supabase
    .from("rooms")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();

  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const {
    data: inserted,
    error: insertError,
  } = await supabase
    .from("rooms")
    .insert({
      name,
      slug,
      is_default: false,
      created_by: chatUser.id,
    })
    .select("id, slug, name, is_default, created_at, created_by")
    .single();

  if (insertError) {
    console.error("Error inserting room", insertError);
    return jsonResponse({ error: "Failed to create room" }, { status: 500 });
  }

  console.log("Room created:", inserted);
  return jsonResponse({ room: inserted }, { status: 201 });
}

async function handleDelete(req: Request): Promise<Response> {
  const supabase = createSupabaseClient(req);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const roomId = url.searchParams.get("id");

  if (!roomId) {
    return jsonResponse({ error: "Room ID is required" }, { status: 400 });
  }

  // Get chat user
  const {
    data: chatUser,
    error: chatUserError,
  } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (chatUserError || !chatUser) {
    console.error("Error fetching chat user", chatUserError);
    return jsonResponse({ error: "User not found" }, { status: 400 });
  }

  // Check if user is the creator
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, created_by, is_default")
    .eq("id", roomId)
    .maybeSingle();

  if (roomError || !room) {
    console.error("Error fetching room", roomError);
    return jsonResponse({ error: "Room not found" }, { status: 404 });
  }

  if (room.is_default) {
    return jsonResponse({ error: "Default room cannot be deleted" }, { status: 400 });
  }

  if (room.created_by !== chatUser.id) {
    return jsonResponse({ error: "Only the room creator can delete this room" }, { status: 403 });
  }

  // Delete messages first (due to foreign key)
  await supabase.from("messages").delete().eq("room_id", roomId);

  // Delete the room
  const { error: deleteError } = await supabase
    .from("rooms")
    .delete()
    .eq("id", roomId);

  if (deleteError) {
    console.error("Error deleting room", deleteError);
    return jsonResponse({ error: "Failed to delete room" }, { status: 500 });
  }

  console.log("Room deleted:", roomId);
  return jsonResponse({ success: true });
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

    if (req.method === "DELETE") {
      return await handleDelete(req);
    }

    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  } catch (error) {
    console.error("Error in rooms function", error);
    return jsonResponse({ error: "Internal server error" }, { status: 500 });
  }
});