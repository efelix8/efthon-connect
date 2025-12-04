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

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
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

    const body = await req.json().catch(() => null) as { nickname?: string } | null;

    const rawNickname = body?.nickname ?? "";
    const nickname = rawNickname.trim();

    if (!nickname) {
      return jsonResponse({ error: "Nickname is required" }, { status: 400 });
    }

    if (nickname.length < 2 || nickname.length > 32) {
      return jsonResponse({ error: "Nickname must be between 2 and 32 characters" }, { status: 400 });
    }

    const nicknameRegex = /^[a-zA-Z0-9_\-ğüşöçıİĞÜŞÖÇ ]+$/u;
    if (!nicknameRegex.test(nickname)) {
      return jsonResponse({ error: "Nickname contains invalid characters" }, { status: 400 });
    }

    const forwardedFor = req.headers.get("x-forwarded-for") ?? "";
    const ip = forwardedFor.split(",")[0].trim();
    const ipHash = ip ? await hashIp(ip) : null;

    // Ensure profile exists for this auth user
    const {
      data: existingProfile,
      error: profileSelectError,
    } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, bio")
      .eq("id", user.id)
      .maybeSingle();

    if (profileSelectError) {
      console.error("Error selecting profile", profileSelectError);
      return jsonResponse({ error: "Failed to fetch profile" }, { status: 500 });
    }

    let profile = existingProfile;

    if (!profile) {
      const { data, error } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          display_name: nickname,
        })
        .select("id, display_name, avatar_url, bio")
        .single();

      if (error) {
        console.error("Error inserting profile", error);
        return jsonResponse({ error: "Failed to create profile" }, { status: 500 });
      }

      profile = data;
    }

    // Ensure chat user row exists and is linked to auth user + profile
    const {
      data: existingUser,
      error: userRowSelectError,
    } = await supabase
      .from("users")
      .select("id, nickname, auth_user_id, profile_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (userRowSelectError) {
      console.error("Error selecting users row", userRowSelectError);
      return jsonResponse({ error: "Failed to fetch user mapping" }, { status: 500 });
    }

    let chatUser = existingUser;

    if (!chatUser) {
      const { data, error } = await supabase
        .from("users")
        .insert({
          auth_user_id: user.id,
          profile_id: user.id,
          nickname,
          ip_hash: ipHash,
        })
        .select("id, nickname, auth_user_id, profile_id")
        .single();

      if (error) {
        console.error("Error inserting users row", error);
        return jsonResponse({ error: "Failed to create user mapping" }, { status: 500 });
      }

      chatUser = data;
    } else {
      // Optionally update nickname / ip_hash on subsequent calls
      const { error } = await supabase
        .from("users")
        .update({ nickname, ip_hash: ipHash, last_seen_at: new Date().toISOString() })
        .eq("id", chatUser.id);

      if (error) {
        console.error("Error updating users row", error);
      }

      chatUser.nickname = nickname;
    }

    return jsonResponse({
      user: {
        id: chatUser.id,
        nickname: chatUser.nickname,
      },
      profile: {
        id: profile.id,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        bio: profile.bio,
      },
    });
  } catch (error) {
    console.error("Error in auth-nickname function", error);
    return jsonResponse({ error: "Internal server error" }, { status: 500 });
  }
});
