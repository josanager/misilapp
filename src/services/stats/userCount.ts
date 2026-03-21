import { supabase } from '../../lib/supabase';

export async function getOnlineUsersCount(): Promise<number> {
  try {
    // Count users who have status online and last_seen within the last 5 minutes (300 seconds)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { count, error } = await supabase
      .from('user_presence')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'online')
      .gt('last_seen', fiveMinutesAgo);

    if (error) {
      console.error('Error fetching online users count:', error);
      return 0;
    }

    return count || 0;
  } catch (err) {
    console.error('Exception fetching online users count:', err);
    return 0;
  }
}
