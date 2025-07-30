// src/integrations/supabase/client.ts

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// VERIFY THESE VALUES ARE CORRECT
const SUPABASE_URL = "https://lcfzfdjeidinenxcucvj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjZnpmZGplaWRpbmVueGN1Y3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2MDc5NzQsImV4cCI6MjA2OTE4Mzk3NH0.L2yGpkzUozHalZUxI-z0zAO_97bMBXbW8APNXqMTSH8";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
