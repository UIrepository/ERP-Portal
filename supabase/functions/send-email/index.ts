// supabase/functions/send-email/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 1. Setup Constants
// Ideally, use Deno.env.get('RESEND_API_KEY') and set it in Supabase secrets
const RESEND_API_KEY = "re_NohT67im_HpFr5YRibxVqYBoGkdG85DSN"; 
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailPayload {
  type: "announcement" | "recording" | "note" | "dpp" | "chat";
  data: {
    title?: string;
    message?: string;
    subject: string | null;
    batch: string | null;
    link?: string;
    senderName?: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase Environment Variables");
    }

    // Initialize Supabase Admin Client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Parse Request Body
    const { type, data }: EmailPayload = await req.json();

    console.log(`Received email request: Type=${type}, Batch=${data.batch}, Subject=${data.subject}`);

    // 2. Query Recipients (Students)
    // We fetch profiles where role is 'student' and the array columns match the target
    let query = supabase
      .from("profiles")
      .select("email, name")
      .eq("role", "student")
      .not("email", "is", null);

    // Filter by Batch (if provided and not 'All')
    // Note: 'batch' column is text[] (array), so we use .contains
    if (data.batch && data.batch !== "All Batches") {
      query = query.contains("batch", [data.batch]);
    }

    // Filter by Subject (if provided and not 'All')
    // Note: 'subjects' column is text[] (array), so we use .contains
    if (data.subject && data.subject !== "All Subjects") {
      query = query.contains("subjects", [data.subject]);
    }

    const { data: students, error: dbError } = await query;

    if (dbError) {
      console.error("Database Error:", dbError);
      throw dbError;
    }

    if (!students || students.length === 0) {
      console.log("No matching students found.");
      return new Response(JSON.stringify({ message: "No recipients found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Construct Email Content
    let emailSubject = "";
    let emailHtml = "";
    const batchPrefix = data.batch ? `[${data.batch}] ` : "";

    switch (type) {
      case "announcement":
        emailSubject = `${batchPrefix}Announcement: ${data.title}`;
        emailHtml = `
          <div style="font-family: sans-serif; color: #333;">
            <h2 style="color: #2563eb;">📢 New Announcement</h2>
            <p><strong>Subject:</strong> ${data.subject || "General"}</p>
            <hr style="border: 0; border-top: 1px solid #eee;" />
            <h3>${data.title}</h3>
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
              ${data.message?.replace(/\n/g, "<br/>")}
            </div>
            <p style="color: #64748b; font-size: 12px; margin-top: 20px;">Sent via ERP Portal</p>
          </div>
        `;
        break;

      case "recording":
        emailSubject = `${batchPrefix}New Lecture: ${data.subject}`;
        emailHtml = `
          <div style="font-family: sans-serif; color: #333;">
            <h2 style="color: #dc2626;">🎥 New Lecture Recording</h2>
            <p>A new video lecture has been uploaded for <strong>${data.subject}</strong>.</p>
            <p><strong>Topic:</strong> ${data.title}</p>
            ${data.link ? `
              <div style="margin-top: 20px;">
                <a href="${data.link}" style="background-color: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Watch Now</a>
              </div>
            ` : ""}
          </div>
        `;
        break;

      case "note":
      case "dpp":
        const typeLabel = type === "dpp" ? "DPP" : "Notes";
        emailSubject = `${batchPrefix}New ${typeLabel}: ${data.subject}`;
        emailHtml = `
          <div style="font-family: sans-serif; color: #333;">
            <h2 style="color: #059669;">📄 New ${typeLabel} Uploaded</h2>
            <p>New study material is available for <strong>${data.subject}</strong>.</p>
            <p><strong>Title:</strong> ${data.title}</p>
            ${data.link ? `
              <div style="margin-top: 20px;">
                <a href="${data.link}" style="background-color: #059669; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Download PDF</a>
              </div>
            ` : ""}
          </div>
        `;
        break;

      case "chat":
        emailSubject = `${batchPrefix}Priority Message in ${data.subject}`;
        emailHtml = `
          <div style="font-family: sans-serif; color: #333;">
            <h2 style="color: #d97706;">💬 High Priority Message</h2>
            <p><strong>From:</strong> ${data.senderName || "Teacher"}</p>
            <div style="background-color: #fffbeb; padding: 15px; border-left: 4px solid #d97706; margin: 15px 0;">
              ${data.message?.replace(/\n/g, "<br/>")}
            </div>
            <p>Please check the community chat for more details.</p>
          </div>
        `;
        break;
    }

    // 4. Send Emails via Resend (BCC Strategy for Bulk)
    const emails = students.map((s) => s.email);
    console.log(`Sending to ${emails.length} recipients...`);
    
    // Resend limit per request is often 50 for BCC. We use 45 to be safe.
    const CHUNK_SIZE = 45;
    const emailPromises = [];

    for (let i = 0; i < emails.length; i += CHUNK_SIZE) {
      const chunk = emails.slice(i, i + CHUNK_SIZE);
      
      const reqBody = {
        from: "Batch Allotment <onboarding@resend.dev>", // Or your verified domain
        to: ["delivered@resend.dev"], // Dummy TO address required for BCC
        bcc: chunk,
        subject: emailSubject,
        html: emailHtml,
      };

      emailPromises.push(
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify(reqBody),
        })
      );
    }

    await Promise.all(emailPromises);

    return new Response(JSON.stringify({ success: true, count: emails.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
