import type {
  Group,
  GroupMember,
  LocalBlob,
  Message,
  MessageReaction,
  Profile,
  StorageStatus,
  Topic,
} from '../types';

export const LOCAL_NODE_URL = import.meta.env.VITE_LOCAL_NODE_URL || 'http://127.0.0.1:4317';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${LOCAL_NODE_URL}${path}`, {
    ...options,
    headers: {
      ...(options?.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...options?.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `El nodo local respondió con ${response.status}.`);
  return data as T;
}

function jsonBody(value: unknown): Pick<RequestInit, 'body'> {
  return { body: JSON.stringify(value) };
}

export const localApi = {
  health: () => request<{ ok: boolean; storage: StorageStatus; profile: Profile }>('/v1/health'),
  profile: () => request<Profile>('/v1/profile'),
  updateProfile: (updates: Partial<Profile>) => request<Profile>('/v1/profile', { method: 'PATCH', ...jsonBody(updates) }),
  storage: () => request<StorageStatus>('/v1/storage'),
  groups: () => request<Group[]>('/v1/groups'),
  group: (id: string) => request<Group>(`/v1/groups/${id}`),
  createGroup: (name: string, description: string, isPublic: boolean) => request<Group>('/v1/groups', {
    method: 'POST', ...jsonBody({ name, description, is_public: isPublic }),
  }),
  updateGroup: (id: string, updates: Partial<Group>) => request<Group>(`/v1/groups/${id}`, {
    method: 'PATCH', ...jsonBody(updates),
  }),
  deleteGroup: (id: string) => request<{ ok: boolean }>(`/v1/groups/${id}`, { method: 'DELETE' }),
  topics: (groupId: string) => request<Topic[]>(`/v1/groups/${groupId}/topics`),
  createTopic: (groupId: string, name: string, description: string) => request<Topic>(`/v1/groups/${groupId}/topics`, {
    method: 'POST', ...jsonBody({ name, description }),
  }),
  members: (groupId: string) => request<GroupMember[]>(`/v1/groups/${groupId}/members`),
  messages: (topicId: string) => request<Message[]>(`/v1/topics/${topicId}/messages`),
  createMessage: (message: Partial<Message>) => request<Message>('/v1/messages', { method: 'POST', ...jsonBody(message) }),
  editMessage: (id: string, content: string) => request<Message>(`/v1/messages/${id}`, { method: 'PATCH', ...jsonBody({ content }) }),
  deleteMessage: (id: string) => request<{ ok: boolean; deleted?: string[] }>(`/v1/messages/${id}`, { method: 'DELETE' }),
  reactions: (messageIds: string[]) => request<MessageReaction[]>(`/v1/reactions?messageIds=${encodeURIComponent(messageIds.join(','))}`),
  toggleReaction: (messageId: string, emoji: string) => request<MessageReaction[]>('/v1/reactions/toggle', {
    method: 'POST', ...jsonBody({ message_id: messageId, emoji }),
  }),
  media: (groupId: string) => request<Message[]>(`/v1/media?groupId=${encodeURIComponent(groupId)}`),
  ratings: (messageIds: string[]) => request<Array<{ message_id: string; avg: number; count: number; user_rating?: number }>>(`/v1/ratings?messageIds=${encodeURIComponent(messageIds.join(','))}`),
  rate: (messageId: string, rating: number) => request<{ ok: boolean }>('/v1/ratings', { method: 'POST', ...jsonBody({ message_id: messageId, rating }) }),
  view: (messageId: string) => request<{ ok: boolean }>(`/v1/messages/${messageId}/view`, { method: 'POST' }),
  uploadBlob: (file: File, onProgress: (loaded: number) => void, signal?: AbortSignal) => new Promise<LocalBlob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${LOCAL_NODE_URL}/v1/blobs`);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
    xhr.upload.onprogress = (event) => onProgress(event.loaded);
    xhr.onload = () => {
      let data: { error?: string } & Partial<LocalBlob> = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* handled below */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as LocalBlob);
      else reject(new Error(data.error || `La subida local falló con ${xhr.status}.`));
    };
    xhr.onerror = () => reject(new Error('No se pudo conectar con MISIL Node.'));
    xhr.onabort = () => reject(new DOMException('Subida cancelada', 'AbortError'));
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(file);
  }),
  deleteBlob: (id: string) => request<{ ok: boolean }>(`/v1/blobs/${id}`, { method: 'DELETE' }),
};
