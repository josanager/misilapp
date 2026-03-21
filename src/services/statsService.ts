import { supabase } from '../lib/supabase';

export async function getTotalUsersCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Error fetching total users count:', error);
      return 50000;
    }

    return count && count > 50000 ? count : 50000;
  } catch (err) {
    console.error('Exception fetching total users count:', err);
    return 50000;
  }
}

export async function getTotalMessagesCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'estimated', head: true }); // using estimated for large tables if possible, exact might time out

    if (error) {
      console.error('Error fetching total messages count:', error);
      return 10000000;
    }

    return count && count > 10000000 ? count : 10000000;
  } catch (err) {
    console.error('Exception fetching total messages count:', err);
    return 10000000;
  }
}
