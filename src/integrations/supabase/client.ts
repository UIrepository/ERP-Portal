// src/integrations/supabase/client.ts

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// --- MAIN CLIENT (Your Application) ---
const SUPABASE_URL = "https://lcfzfdjeidinenxcucvj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_WnbiNgZi5Q6837SJzMQeew_gUTOxMKh";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// --- SECONDARY CLIENT (External Payments DB) ---
const PAYMENTS_SUPABASE_URL = "https://qzrvctpwefhmcduariuw.supabase.co";
const PAYMENTS_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6cnZjdHB3ZWZobWNkdWFyaXV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY1MTAxNDYsImV4cCI6MjA2MjA4NjE0Nn0.VK1JfGf1zhXbiOc_1N03HQnA0xlpGoynjXRkb_k2NJ0";

// We use a generic client here since we don't have the full type definitions for the external project
export const paymentsClient = createClient(PAYMENTS_SUPABASE_URL, PAYMENTS_SUPABASE_KEY, {
  auth: {
    persistSession: false // We only need this for reading public data, no auth session needed
  }
});
