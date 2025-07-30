// src/integrations/supabase/client.ts

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// VERIFY THESE VALUES ARE CORRECT
const SUPABASE_URL = "https://lcfzfdjeidinenxcucvj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_WnbiNgZi5Q6837SJzMQeew_gUTOxMKh";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
