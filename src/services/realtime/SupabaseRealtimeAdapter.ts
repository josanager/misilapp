import { supabase, Message } from '../../lib/supabase';
import { RealtimeTransport, RealtimeMessageEvents, RealtimeSubscription, RealtimeReactionEvents } from './RealtimeTransport';

export class SupabaseRealtimeAdapter implements RealtimeTransport {
  subscribeToTopicMessages(topicId: string, events: RealtimeMessageEvents): RealtimeSubscription {
    const channel = supabase
      .channel(`messages:${topicId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `topic_id=eq.${topicId}`,
      }, async (payload) => {
        if (payload.eventType === 'INSERT' && events.onInsert) {
          const { data } = await supabase
            .from('messages')
            .select('*, profile:profiles(*)')
            .eq('id', payload.new.id)
            .single();
          if (data) events.onInsert(data);
        } else if (payload.eventType === 'UPDATE' && events.onUpdate) {
          events.onUpdate(payload.new as Message);
        } else if (payload.eventType === 'DELETE' && events.onDelete) {
          events.onDelete(payload.old.id);
        }
      })
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      }
    };
  }

  subscribeToTopicReactions(topicId: string, events: RealtimeReactionEvents): RealtimeSubscription {
    const channel = supabase
      .channel(`reactions:${topicId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'message_reactions',
      }, (payload) => {
        const msgId = (payload.new as any)?.message_id || (payload.old as any)?.message_id;
        if (msgId && events.onReactionChange) {
          events.onReactionChange(msgId);
        }
      })
      .subscribe();

    return {
      unsubscribe: () => supabase.removeChannel(channel)
    };
  }

  subscribeToPresence(groupId: string, onSync: (userIds: string[]) => void, trackUser?: { userId: string }): RealtimeSubscription {
    const channel = supabase.channel(`presence:${groupId}`, {
      config: { presence: { key: 'user_id' } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        onSync(Object.keys(state));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && trackUser) {
          await channel.track({ user_id: trackUser.userId, online_at: new Date().toISOString() });
        }
      });

    return {
      unsubscribe: () => supabase.removeChannel(channel)
    };
  }
}

// Global instance to use throughout the app
export const realtimeService = new SupabaseRealtimeAdapter();
