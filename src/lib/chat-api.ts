import { supabase } from "@/integrations/supabase/client";

export const FUNCTION_BASE = "https://uobglgbzfzlnmdapirtz.functions.supabase.co/functions/v1";

export interface Room {
  id: string;
  slug: string;
  name: string;
  is_default?: boolean;
  created_at?: string;
  created_by?: string;
  has_password?: boolean;
}

export interface ChatUser {
  id: string;
  nickname: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  imageUrl?: string | null;
  createdAt: string;
  editedAt: string | null;
  roomId: string;
  user: ChatUser | null;
  deliveredAt?: string | null;
  readCount?: number;
}

export const markMessageAsRead = async (messageId: string, userId: string): Promise<void> => {
  const { error } = await supabase
    .from('message_reads')
    .upsert({ message_id: messageId, user_id: userId }, { onConflict: 'message_id,user_id' });
  
  if (error) {
    console.error('Error marking message as read:', error);
  }
};

interface RoomsResponse {
  rooms: Room[];
}

interface MessagesResponse {
  room: Pick<Room, "id" | "slug" | "name">;
  messages: ChatMessage[];
}

interface SendMessageResponse {
  room: Pick<Room, "id" | "slug" | "name">;
  message: ChatMessage;
}

interface CreateRoomResponse {
  room: Room;
}

interface NicknameResponse {
  user: ChatUser;
  profile: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
  };
}

const authorizedGet = async <T>(path: string, accessToken: string): Promise<T> => {
  const res = await fetch(`${FUNCTION_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = (await res.json().catch(() => null)) as any;

  if (!res.ok) {
    const message = data?.error || "İstek başarısız oldu";
    throw new Error(message);
  }

  return data as T;
};

export const fetchRooms = async (accessToken: string): Promise<Room[]> => {
  if (!accessToken) throw new Error("Oturum bulunamadı");
  const data = await authorizedGet<RoomsResponse>("/rooms", accessToken);
  return data.rooms;
};

export const fetchMessages = async (
  accessToken: string,
  roomSlug: string,
  limit: number = 100,
): Promise<MessagesResponse> => {
  if (!accessToken) throw new Error("Oturum bulunamadı");

  // Get room first
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, slug, name")
    .eq("slug", roomSlug)
    .single();

  if (roomError || !room) throw new Error("Oda bulunamadı");

  // Fetch messages with user info directly
  const { data: messages, error: msgError } = await supabase
    .from("messages")
    .select(`
      id,
      content,
      image_url,
      created_at,
      edited_at,
      room_id,
      delivered_at,
      user_id,
      users_public!messages_user_id_fkey (id, nickname)
    `)
    .eq("room_id", room.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (msgError) throw new Error(msgError.message);

  // Get read counts
  const messageIds = (messages || []).map(m => m.id);
  const { data: readCounts } = await supabase
    .from("message_reads")
    .select("message_id")
    .in("message_id", messageIds);

  const readCountMap = new Map<string, number>();
  (readCounts || []).forEach(r => {
    readCountMap.set(r.message_id, (readCountMap.get(r.message_id) || 0) + 1);
  });

  const formattedMessages: ChatMessage[] = (messages || []).map(m => ({
    id: m.id,
    content: m.content,
    imageUrl: m.image_url,
    createdAt: m.created_at,
    editedAt: m.edited_at,
    roomId: m.room_id,
    deliveredAt: m.delivered_at,
    readCount: readCountMap.get(m.id) || 0,
    user: m.users_public ? { id: m.users_public.id!, nickname: m.users_public.nickname! } : null,
  }));

  return { room, messages: formattedMessages };
};

export const sendMessage = async (
  roomSlug: string, 
  content: string, 
  imageUrl?: string
): Promise<ChatMessage> => {
  const { data, error } = await supabase.functions.invoke<SendMessageResponse>("messages", {
    body: { room: roomSlug, content, imageUrl },
  });

  if (error) {
    throw new Error(error.message || "Mesaj gönderilirken bir hata oluştu");
  }

  if (!data) {
    throw new Error("Beklenmeyen yanıt alındı");
  }

  return data.message;
};

export const editMessage = async (messageId: string, content: string): Promise<void> => {
  const session = await supabase.auth.getSession();
  const accessToken = session.data.session?.access_token;
  
  if (!accessToken) throw new Error("Oturum bulunamadı");

  const res = await fetch(`${FUNCTION_BASE}/messages`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messageId, content }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || "Mesaj düzenlenirken bir hata oluştu");
  }
};

export const removeMessageImage = async (messageId: string): Promise<void> => {
  const session = await supabase.auth.getSession();
  const accessToken = session.data.session?.access_token;
  
  if (!accessToken) throw new Error("Oturum bulunamadı");

  const res = await fetch(`${FUNCTION_BASE}/messages`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messageId, removeImage: true }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || "Fotoğraf kaldırılırken bir hata oluştu");
  }
};

export const deleteMessage = async (messageId: string): Promise<void> => {
  const session = await supabase.auth.getSession();
  const accessToken = session.data.session?.access_token;
  
  if (!accessToken) throw new Error("Oturum bulunamadı");

  const res = await fetch(`${FUNCTION_BASE}/messages?id=${messageId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || "Mesaj silinirken bir hata oluştu");
  }
};

export const setNickname = async (nickname: string): Promise<NicknameResponse> => {
  const { data, error } = await supabase.functions.invoke<NicknameResponse>("auth-nickname", {
    body: { nickname },
  });

  if (error) {
    throw new Error(error.message || "Takma ad kaydedilirken bir hata oluştu");
  }

  if (!data) {
    throw new Error("Beklenmeyen yanıt alındı");
  }

  return data;
};

export const createRoom = async (name: string): Promise<Room> => {
  const { data, error } = await supabase.functions.invoke<CreateRoomResponse>("rooms", {
    body: { name },
  });

  if (error) {
    throw new Error(error.message || "Oda oluşturulurken bir hata oluştu");
  }

  if (!data) {
    throw new Error("Beklenmeyen yanıt alındı");
  }

  return data.room;
};

export const deleteRoom = async (roomId: string): Promise<void> => {
  const session = await supabase.auth.getSession();
  const accessToken = session.data.session?.access_token;
  
  if (!accessToken) throw new Error("Oturum bulunamadı");

  const res = await fetch(`${FUNCTION_BASE}/rooms?id=${roomId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || "Oda silinirken bir hata oluştu");
  }
};

export const uploadChatFile = async (file: File, userId: string): Promise<string> => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}.${fileExt}`;
  
  const { error } = await supabase.storage
    .from('chat-images')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    throw new Error(error.message || "Dosya yüklenirken bir hata oluştu");
  }

  const { data: { publicUrl } } = supabase.storage
    .from('chat-images')
    .getPublicUrl(fileName);

  return publicUrl;
};

// Backwards compatibility alias
export const uploadChatImage = uploadChatFile;

// AI Sinan - responds when users say "hey sinan"
export interface AISinanResponse {
  response: string;
  error?: string;
}

export const askAISinan = async (
  userMessage: string,
  conversationHistory: { content: string; isAI: boolean }[]
): Promise<string> => {
  const response = await fetch(`${FUNCTION_BASE}/ai-sinan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userMessage,
      conversationHistory,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'AI yanıt veremedi');
  }

  const data: AISinanResponse = await response.json();
  return data.response;
};

// Check if message triggers AI Sinan
export const shouldTriggerAISinan = (content: string): boolean => {
  const lowerContent = content.toLowerCase().trim();
  const triggers = [
    'hey sinan', 'selam sinan', 'sinan yardım', 'yo sinan', 'abi sinan',
    'sinan abi', 'sinan kardeş', 'sinan bey', 'sinan hoca', 'lan sinan',
    'be sinan', 'ulan sinan', 'sinan reis', 'reis sinan', 'sinan naber',
    'naber sinan', 'sinan gel', 'sinan bak', 'sinan dinle', 'sinan yardım et',
    'sinan ne diyon', 'sinan napıyon', 'sinan sen', 'sinan bir', 'sinan bi',
    '@sinan', 'sinan?', 'sinan!', 'sinancım', 'sinanım'
  ];
  
  // Check if message contains any trigger
  if (triggers.some(trigger => lowerContent.includes(trigger))) {
    return true;
  }
  
  // Check if message starts with sinan
  if (lowerContent.startsWith('sinan,') || lowerContent.startsWith('sinan ')) {
    return true;
  }
  
  return false;
};