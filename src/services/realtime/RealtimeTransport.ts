import { Message } from '../../lib/supabase';

export interface RealtimeSubscription {
  unsubscribe: () => void;
}

export interface RealtimeMessageEvents {
  onInsert?: (message: Message) => void;
  onUpdate?: (message: Message) => void;
  onDelete?: (messageId: string) => void;
}

export interface RealtimeReactionEvents {
  onReactionChange?: (messageId: string) => void;
}

export interface RealtimeTransport {
  subscribeToTopicMessages(topicId: string, events: RealtimeMessageEvents): RealtimeSubscription;
  subscribeToTopicReactions(topicId: string, events: RealtimeReactionEvents): RealtimeSubscription;
  subscribeToPresence(groupId: string, onSync: (userIds: string[]) => void, trackUser?: { userId: string }): RealtimeSubscription;
}
