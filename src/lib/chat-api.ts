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
  user: ChatUser;
}

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
): Promise<MessagesResponse> => {
  if (!accessToken) throw new Error("Oturum bulunamadı");
  const params = new URLSearchParams({ room: roomSlug, limit: "50" });
  return authorizedGet<MessagesResponse>(`/messages?${params.toString()}`, accessToken);
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