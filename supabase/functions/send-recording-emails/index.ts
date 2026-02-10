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
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const todayStr = istNow.toISOString().slice(0, 10);
    const currentTimeStr = istNow.toISOString().slice(11, 16);
    const currentDow = istNow.getUTCDay();

    console.log(`Checking recording emails at IST ${currentTimeStr}, date ${todayStr}`);

    // Get recordings from today that haven't had email sent
    const { data: recordings, error: recErr } = await supabase
      .from('recordings')
      .select('id, batch, subject, topic, date, recording_email_sent')
      .eq('date', todayStr)
      .eq('recording_email_sent', false);

    if (recErr) {
      console.error('Error fetching recordings:', recErr);
      throw recErr;
    }

    const results: { recording_id: string; status: string }[] = [];

    for (const recording of recordings || []) {
      // Check if the schedule's end_time has passed for this batch + subject today
      const { data: schedules } = await supabase
        .from('schedules')
        .select('end_time, date, day_of_week')
        .eq('batch', recording.batch)
        .eq('subject', recording.subject);

      // Find matching schedule for today
      let classEnded = false;
      for (const sched of schedules || []) {
        const isDateMatch = sched.date === todayStr;
        const isDowMatch = sched.date === null && sched.day_of_week === currentDow;
        
        if (!isDateMatch && !isDowMatch) continue;

        const endTime = sched.end_time?.slice(0, 5);
        if (endTime && currentTimeStr >= endTime) {
          classEnded = true;
          break;
        }
      }

      if (!classEnded) {
        results.push({ recording_id: recording.id, status: 'class_not_ended_yet' });
        continue;
      }

      // Look up Google Group
      const { data: group } = await supabase
        .from('google_groups')
        .select('group_email')
        .eq('batch_name', recording.batch)
        .eq('subject_name', recording.subject)
        .eq('is_active', true)
        .maybeSingle();

      if (!group?.group_email) {
        results.push({ recording_id: recording.id, status: 'no_group_found' });
        continue;
      }

      const emailText = `Dear Student,

A new recording has been uploaded for your course.

Subject: ${recording.subject}
Topic: ${recording.topic}
Date: ${recording.date}

Please check your dashboard to watch the recording.

Regards,
Unknown IITians Academic Team`;

      try {
        await resend.emails.send({
          from: 'Unknown IITians <notifications@hq.unknowniitians.com>',
          to: [group.group_email],
          subject: `Unknown IITians - New Recording: ${recording.topic} (${recording.subject})`,
          text: emailText,
        });

        // Mark as sent
        await supabase
          .from('recordings')
          .update({ recording_email_sent: true } as any)
          .eq('id', recording.id);

        results.push({ recording_id: recording.id, status: 'sent' });
      } catch (err) {
        console.error(`Failed to send recording email for ${recording.id}:`, err);
        results.push({ recording_id: recording.id, status: `error: ${(err as Error).message}` });
      }
    }

    console.log('Recording email results:', JSON.stringify(results));

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('send-recording-emails error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
