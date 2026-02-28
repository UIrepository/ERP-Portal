import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Routing traffic securely through your own Vercel SSP domain
const SUPABASE_URL = "https://ssp.unknowniitians.live/supa-proxy";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_WnbiNgZi5Q6837SJzMQeew_gUTOxMKh";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
