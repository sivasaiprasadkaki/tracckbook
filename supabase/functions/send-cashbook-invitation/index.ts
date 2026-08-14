import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { recipientEmail, recipientName, cashbookName, role, invitationUrl, inviterEmail, inviterName } = await req.json();

    if (!recipientEmail || !cashbookName || !invitationUrl) {
      return new Response(
        JSON.stringify({ error: "Missing required invitation parameters: recipientEmail, cashbookName, invitationUrl" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Edge Function send-cashbook-invitation] Dispatching email to ${recipientEmail} for cashbook ${cashbookName}`);

    if (!RESEND_API_KEY) {
      console.warn("[Edge Function] RESEND_API_KEY secret is not set in Edge Function secrets.");
      // Return helpful message indicating API key requirement
      return new Response(
        JSON.stringify({
          error: "Unable to send invitation email. RESEND_API_KEY secret is missing in Edge Function environment.",
          code: "RESEND_KEY_MISSING"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Role Permission Summaries
    const rolePermissionSummaries: Record<string, string> = {
      "Admin": "Full cashbook management, member management, entry edits, and reports export.",
      "Book Admin": "Manage cashbook entries, categorize transactions, and invite book members.",
      "Data Operator": "Add and view financial cashbook entries and attach receipt vouchers.",
      "Viewer": "Read-only access to view cashbook entries, summary balances, and analytics reports."
    };

    const permSummary = rolePermissionSummaries[role] || "Access cashbook data according to assigned role permissions.";

    // Send email via Resend API
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "TrackBook Cashbooks <onboarding@resend.dev>",
        to: [recipientEmail],
        subject: "You're invited to join a TrackBook Cashbook",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>TrackBook Cashbook Invitation</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 32px 16px; color: #18181b; }
              .card { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e4e4e7; padding: 36px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
              .brand { display: flex; align-items: center; gap: 8px; margin-bottom: 24px; }
              .brand-logo { font-size: 22px; font-weight: 900; color: #059669; letter-spacing: -0.5px; }
              .brand-tag { font-size: 11px; background: #ecfdf5; color: #047857; font-weight: 700; padding: 2px 8px; border-radius: 6px; border: 1px solid #a7f3d0; text-transform: uppercase; }
              .title { font-size: 20px; font-weight: 800; color: #09090b; margin-top: 0; margin-bottom: 12px; line-height: 1.3; }
              .body-text { font-size: 14px; color: #52525b; line-height: 1.6; margin-bottom: 24px; }
              .details-box { background: #fafafa; border: 1px solid #e4e4e7; border-radius: 12px; padding: 20px; margin-bottom: 28px; }
              .details-row { margin-bottom: 12px; font-size: 13px; }
              .details-row:last-child { margin-bottom: 0; }
              .label { color: #71717a; font-weight: 600; display: block; font-size: 11px; text-transform: uppercase; tracking: 0.5px; margin-bottom: 2px; }
              .value { font-weight: 700; color: #18181b; font-size: 14px; }
              .role-badge { display: inline-block; background: #10b981; color: #ffffff; font-weight: 800; padding: 3px 10px; border-radius: 6px; font-size: 12px; }
              .cta-btn { display: block; width: 100%; text-align: center; background-color: #059669; color: #ffffff !important; font-weight: 800; font-size: 15px; padding: 14px 24px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25); margin-bottom: 24px; box-sizing: border-box; }
              .expiry-note { font-size: 12px; color: #71717a; text-align: center; margin-bottom: 24px; }
              .plain-link { font-size: 11px; color: #a1a1aa; word-break: break-all; margin-top: 20px; padding-top: 16px; border-top: 1px solid #f4f4f5; }
              .footer { text-align: center; font-size: 11px; color: #a1a1aa; margin-top: 28px; line-height: 1.5; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="brand">
                <span class="brand-logo">TrackBook</span>
                <span class="brand-tag">Cashbooks</span>
              </div>

              <h1 class="title">You're invited to join a TrackBook Cashbook</h1>

              <p class="body-text">
                ${inviterName || inviterEmail ? `<strong>${inviterName || inviterEmail}</strong> has invited you` : 'You have been invited'} to collaborate on TrackBook AI Expense Management.
              </p>

              <div class="details-box">
                <div class="details-row">
                  <span class="label">Cashbook Workspace</span>
                  <span class="value">${cashbookName}</span>
                </div>
                <div class="details-row">
                  <span class="label">Assigned Role</span>
                  <span class="role-badge">${role}</span>
                </div>
                <div class="details-row">
                  <span class="label">Role Permissions Summary</span>
                  <span class="value" style="font-weight: 500; font-size: 13px; color: #3f3f46;">${permSummary}</span>
                </div>
                <div class="details-row">
                  <span class="label">Invited Email</span>
                  <span class="value" style="font-family: monospace;">${recipientEmail}</span>
                </div>
              </div>

              <a href="${invitationUrl}" class="cta-btn">Accept Invitation</a>

              <p class="expiry-note">
                ⏱️ This invitation expires in <strong>7 days</strong>.
              </p>

              <div class="plain-link">
                If the button above does not work, copy and paste this link into your browser:<br>
                <a href="${invitationUrl}" style="color: #059669;">${invitationUrl}</a>
              </div>

              <div class="footer">
                If you were not expecting this invitation, you can safely ignore this email.<br>
                <strong>TrackBook AI Expense Management</strong>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      console.error("[Edge Function] Resend API error response:", errText);
      return new Response(
        JSON.stringify({ error: "Unable to send invitation email. Please try again.", providerError: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendData = await resendResponse.json();
    console.log("[Edge Function] Email sent successfully via Resend:", resendData);

    return new Response(
      JSON.stringify({ success: true, message: `Invitation sent successfully to ${recipientEmail}`, data: resendData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[Edge Function] Error in send-cashbook-invitation:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Unable to send invitation email. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
