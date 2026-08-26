import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// The portal is served from several production domains (all Vercel aliases of
// the same app) plus local dev — echo the caller's origin back when it's one of
// them. Hardcoding only .com blocked enrollment-linking on the .in / .live
// domains (and on localhost), so those users silently never got linked.
const ALLOWED_ORIGINS = [
  'https://ssp.unknowniitians.com',
  'https://ssp.unknowniitians.in',
  'https://ssp.unknowniitians.live',
  'http://localhost:8080',
  'http://localhost:5173',
];
function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('Origin'));

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  try {
    // Verify the caller's identity matches the email being linked
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify the JWT and get the authenticated user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const { email, user_id } = await req.json();
    console.log('Linking enrollments for:', { email, user_id });

    if (!email || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing email or user_id' }),
        { 
          status: 400, 
          headers: { ...cors, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Authorization: ensure the authenticated user can only link their own enrollments
    if (user.id !== user_id || user.email?.toLowerCase() !== email.toLowerCase().trim()) {
      console.error('Authorization mismatch:', { 
        authUserId: user.id, requestUserId: user_id,
        authEmail: user.email, requestEmail: email 
      });
      return new Response(
        JSON.stringify({ error: 'You can only link your own enrollments' }),
        { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Update all enrollments matching this email to add user_id
    // Only update records where user_id is currently null
    const { data, error, count } = await supabase
      .from('user_enrollments')
      .update({ user_id })
      .eq('email', email.toLowerCase().trim())
      .is('user_id', null)
      .select('id');

    if (error) {
      console.error('Error linking enrollments:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { 
          status: 500, 
          headers: { ...cors, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Linked ${data?.length || 0} enrollments for user ${email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        linked: data?.length || 0,
        enrollments: data 
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Link enrollments error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...cors, 'Content-Type': 'application/json' } 
      }
    );
  }
});
