import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, user_id } = await req.json();
    console.log('Linking enrollments for:', { email, user_id });

    if (!email || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing email or user_id' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Update all enrollments matching this email to add user_id
    // Only update records where user_id is currently null
    const { data, error, count } = await supabase
      .from('user_enrollments')
      .update({ user_id })
      .eq('email', email.toLowerCase().trim())
      .is('user_id', null)
      .select();

    if (error) {
      console.error('Error linking enrollments:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Link enrollments error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
