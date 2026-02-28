// src/integrations/supabase/client.ts

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Updated to point to the Jiobase proxy URL for the ERP portal
const SUPABASE_URL = "https://sspui.jiobase.com";

// Your original Supabase anon key remains exactly the same
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_WnbiNgZi5Q6837SJzMQeew_gUTOxMKh";

// Updated createClient call to use a single options object to address the deprecation warning.
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
