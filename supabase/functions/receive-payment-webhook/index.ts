import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature',
};

async function verifyRazorpaySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const expectedSignature = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return expectedSignature === signature;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Read raw body for signature verification
    const rawBody = await req.text();

    // Verify Razorpay webhook signature
    const razorpaySignature = req.headers.get('x-razorpay-signature');
    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');

    if (!webhookSecret) {
      console.error('RAZORPAY_WEBHOOK_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Webhook secret not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!razorpaySignature) {
      console.error('Missing x-razorpay-signature header');
      return new Response(
        JSON.stringify({ error: 'Missing signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isValid = await verifyRazorpaySignature(rawBody, razorpaySignature, webhookSecret);
    if (!isValid) {
      console.error('Invalid Razorpay webhook signature');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Razorpay signature verified successfully');

    const payload = JSON.parse(rawBody);
    console.log('Received payment webhook payload:', JSON.stringify(payload));

    const { batch, courses, customer_email, status } = payload;

    // Only process successful payments
    if (status !== 'success') {
      console.log('Skipping non-success payment:', status);
      return new Response(
        JSON.stringify({ skipped: true, reason: 'status not success' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields
    if (!batch || !courses || !customer_email) {
      console.log('Missing required fields:', { batch, courses, customer_email });
      return new Response(
        JSON.stringify({ skipped: true, reason: 'missing required fields' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Connect to local Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Handle comma-separated courses
    const courseList = courses.split(',').map((c: string) => c.trim()).filter((c: string) => c.length > 0);
    console.log('Processing courses:', courseList);

    let synced = 0;
    const errors: string[] = [];

    for (const course of courseList) {
      // Upsert: insert if not exists, update if exists
      const { error } = await supabase
        .from('user_enrollments')
        .upsert({
          email: customer_email.toLowerCase().trim(),
          batch_name: batch.trim(),
          subject_name: course.trim(),
          user_id: null  // Will be filled when user logs in
        }, { 
          onConflict: 'email,batch_name,subject_name',
          ignoreDuplicates: true
        });

      if (error) {
        console.error('Error upserting enrollment:', error);
        errors.push(`${course}: ${error.message}`);
      } else {
        synced++;
        console.log(`Synced enrollment: ${customer_email} -> ${batch}/${course}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced,
        total_courses: courseList.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
