import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'npm:resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { batch, subject, message_content, sender_name } = await req.json();

    if (!batch || !subject || !message_content) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: batch, subject, message_content' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resend = new Resend(resendKey);

    // Look up Google Group for this batch + subject
    const { data: group } = await supabase
      .from('google_groups')
      .select('group_email')
      .eq('batch_name', batch)
      .eq('subject_name', subject)
      .eq('is_active', true)
      .maybeSingle();

    if (!group?.group_email) {
      return new Response(
        JSON.stringify({ error: `No Google Group found for ${subject} - ${batch}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailText = `Dear Student,

You have a new message from ${sender_name || 'your teacher'} in ${subject} (${batch}).

Message:
${message_content}

Please check the community section on your dashboard for details.

Regards,
Unknown IITians Academic Team`;

    const emailResponse = await resend.emails.send({
      from: 'Unknown IITians <notifications@hq.unknowniitians.com>',
      to: [group.group_email],
      subject: `Unknown IITians - ${subject}: Message from ${sender_name || 'Teacher'}`,
      text: emailText,
    });

    console.log('Community email sent:', emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('send-community-email error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
