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
      console.error('RESEND_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resend = new Resend(resendKey);
    const now = new Date();
    
    // Get current time in IST (UTC+5:30)
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const currentTimeStr = istNow.toISOString().slice(11, 16); // HH:MM
    const todayStr = istNow.toISOString().slice(0, 10); // YYYY-MM-DD
    const currentDow = istNow.getUTCDay(); // Day of week (0=Sunday)

    console.log(`Checking reminders at IST ${currentTimeStr}, date ${todayStr}, dow ${currentDow}`);

    // Find schedules where reminder_time is within 1 minute of now
    // and reminder hasn't been sent today
    // Match either by specific date or recurring day_of_week
    const { data: schedules, error: schedErr } = await supabase
      .from('schedules')
      .select('id, batch, subject, start_time, end_time, reminder_time, reminder_sent_date, date, day_of_week')
      .not('reminder_time', 'is', null);

    if (schedErr) {
      console.error('Error fetching schedules:', schedErr);
      throw schedErr;
    }

    const results: { batch: string; subject: string; status: string }[] = [];

    for (const schedule of schedules || []) {
      // Check if this schedule applies today
      const isDateMatch = schedule.date === todayStr;
      const isDowMatch = schedule.date === null && schedule.day_of_week === currentDow;
      
      if (!isDateMatch && !isDowMatch) continue;

      // Check if reminder already sent today
      if (schedule.reminder_sent_date === todayStr) continue;

      // Check if reminder_time matches current time (within 1 minute window)
      const reminderTime = schedule.reminder_time?.slice(0, 5); // HH:MM
      if (!reminderTime) continue;

      // Parse times to minutes for comparison
      const [rh, rm] = reminderTime.split(':').map(Number);
      const [ch, cm] = currentTimeStr.split(':').map(Number);
      const reminderMinutes = rh * 60 + rm;
      const currentMinutes = ch * 60 + cm;
      const diff = Math.abs(currentMinutes - reminderMinutes);

      if (diff > 1) continue;

      console.log(`Sending reminder for ${schedule.subject} - ${schedule.batch}`);

      // Look up the Google Group for this subject
      const { data: group } = await supabase
        .from('google_groups')
        .select('group_email')
        .eq('batch_name', schedule.batch)
        .eq('subject_name', schedule.subject)
        .eq('is_active', true)
        .maybeSingle();

      // Look up the teacher for this batch + subject combo
      const { data: teachers } = await supabase
        .from('teachers')
        .select('email, name')
        .contains('assigned_batches', [schedule.batch])
        .contains('assigned_subjects', [schedule.subject]);

      const emailText = `Dear Student,

Your ${schedule.subject} class is starting in 15 minutes.

Batch: ${schedule.batch}
Time: ${schedule.start_time?.slice(0, 5)} - ${schedule.end_time?.slice(0, 5)}

Please join the class on time through your dashboard.

Regards,
Unknown IITians Academic Team`;

      // Send to Google Group
      if (group?.group_email) {
        try {
          await resend.emails.send({
            from: 'Unknown IITians <notifications@hq.unknowniitians.com>',
            to: [group.group_email],
            subject: `Unknown IITians - Class Reminder: ${schedule.subject}`,
            text: emailText,
          });
          results.push({ batch: schedule.batch, subject: schedule.subject, status: 'sent_to_group' });
        } catch (err) {
          console.error(`Failed to send to group ${group.group_email}:`, err);
          results.push({ batch: schedule.batch, subject: schedule.subject, status: `group_error: ${(err as Error).message}` });
        }
      }

      // Send to teacher(s)
      if (teachers && teachers.length > 0) {
        for (const teacher of teachers) {
          const teacherText = `Dear ${teacher.name},

This is a reminder that your ${schedule.subject} class for ${schedule.batch} is starting in 15 minutes.

Time: ${schedule.start_time?.slice(0, 5)} - ${schedule.end_time?.slice(0, 5)}

Regards,
Unknown IITians Academic Team`;

          try {
            await resend.emails.send({
              from: 'Unknown IITians <notifications@hq.unknowniitians.com>',
              to: [teacher.email],
              subject: `Unknown IITians - Class Reminder: ${schedule.subject} (${schedule.batch})`,
              text: teacherText,
            });
            results.push({ batch: schedule.batch, subject: schedule.subject, status: `sent_to_teacher: ${teacher.email}` });
          } catch (err) {
            console.error(`Failed to send to teacher ${teacher.email}:`, err);
          }
        }
      }

      // Mark reminder as sent today
      await supabase
        .from('schedules')
        .update({ reminder_sent_date: todayStr } as any)
        .eq('id', schedule.id);
    }

    console.log('Reminder results:', JSON.stringify(results));

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('send-class-reminders error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
