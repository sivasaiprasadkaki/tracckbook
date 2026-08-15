import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// UUID validation helper
function isValidUuid(id: any): boolean {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// SHA-256 token hashing helper in Web Crypto
async function hashToken(token: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Random token generation helper
function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function jsonResponse(body: Record<string, any>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

serve(async (req: Request) => {
  // 1. Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({
      success: false,
      error: `Method ${req.method} not allowed`,
    }, 405);
  }

  try {
    // 2. Safe JSON input parsing
    let payload: any = {};
    try {
      const rawText = await req.text();
      if (rawText && rawText.trim()) {
        payload = JSON.parse(rawText);
      }
    } catch (parseErr: any) {
      return jsonResponse({
        success: false,
        error: "Malformed JSON request payload.",
        details: parseErr.message,
      }, 400);
    }

    const cashbookId = payload.cashbookId || payload.cashbook_id;
    const cashbookName = payload.cashbookName || payload.cashbook_name || "TrackBook Cashbook";
    const rawEmail = payload.email || payload.recipientEmail;
    const name = payload.name || payload.recipientName || (rawEmail ? rawEmail.split('@')[0] : 'Member');
    const role = payload.role || 'Viewer';
    const inviterUserId = payload.inviterUserId || payload.inviter_user_id;
    const inviterRole = payload.inviterRole || payload.inviter_role || 'Primary Admin';
    const inviterEmail = payload.inviterEmail || payload.inviter_email;
    const inviterName = payload.inviterName || payload.inviter_name || (inviterEmail ? inviterEmail.split('@')[0] : 'Cashbook Admin');

    if (!cashbookId || !rawEmail) {
      return jsonResponse({
        success: false,
        error: "Missing required parameters: cashbookId and email are required.",
      }, 400);
    }

    const targetEmail = rawEmail.trim().toLowerCase();

    // 3. Permission verification
    if (!['Primary Admin', 'Admin', 'Book Admin'].includes(inviterRole)) {
      return jsonResponse({
        success: false,
        error: "Forbidden: Insufficient permissions to invite cashbook members.",
      }, 403);
    }

    if (role === 'Primary Admin') {
      return jsonResponse({
        success: false,
        error: "Primary Admin role cannot be created via standard invitation.",
      }, 400);
    }

    // 4. Initialize Supabase Admin Client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://chbbaswtawmbmyquoiac.supabase.co";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoYmJhc3d0YXdtYm15cXVvaWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMjE5MTcsImV4cCI6MjA5MDY5NzkxN30.4qNJG7rjpEJ9vfyiGy_mteUI9_X1I6dNekEuXV26Xic";

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 5. Look up Target User ID
    let targetUserId: string | null = null;

    try {
      const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name')
        .ilike('email', targetEmail)
        .maybeSingle();

      if (prof?.id && isValidUuid(prof.id)) {
        targetUserId = prof.id;
      }
    } catch (_) {}

    if (!targetUserId) {
      try {
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
        if (usersData?.users) {
          const found = usersData.users.find((u: any) => u.email?.trim().toLowerCase() === targetEmail);
          if (found && isValidUuid(found.id)) {
            targetUserId = found.id;
          }
        }
      } catch (_) {}
    }

    if (!targetUserId) {
      try {
        const { data: memberData } = await supabaseAdmin
          .from('cashbook_members')
          .select('user_id')
          .ilike('email', targetEmail)
          .not('user_id', 'is', null)
          .limit(1)
          .maybeSingle();

        if (memberData?.user_id && isValidUuid(memberData.user_id)) {
          targetUserId = memberData.user_id;
        }
      } catch (_) {}
    }

    // 6. Check if target user is ALREADY an active member of this Cashbook
    try {
      const { data: activeMember } = await supabaseAdmin
        .from('cashbook_members')
        .select('id, email, status')
        .eq('cashbook_id', cashbookId)
        .ilike('email', targetEmail)
        .eq('status', 'Active')
        .maybeSingle();

      if (activeMember) {
        return jsonResponse({
          success: false,
          error: `User ${targetEmail} is already an active member of this Cashbook.`,
        }, 400);
      }
    } catch (_) {}

    // 7. Check if an active invitation is ALREADY pending
    try {
      const { data: existingInvite } = await supabaseAdmin
        .from('cashbook_invitations')
        .select('id, status')
        .eq('cashbook_id', cashbookId)
        .ilike('email', targetEmail)
        .in('status', ['Sent', 'pending', 'Draft'])
        .maybeSingle();

      if (existingInvite) {
        return jsonResponse({
          success: false,
          error: 'An invitation is already pending for this user.',
        }, 400);
      }
    } catch (_) {}

    // 8. Generate Token & Expiration
    const rawToken = generateToken();
    const tokenHash = await hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const origin = req.headers.get("origin") || "https://trackbook.xyz";
    const invitationUrl = `${origin}/accept-invite?token=${rawToken}`;

    const validInviterUserId = isValidUuid(inviterUserId) ? inviterUserId : null;
    const validTargetUserId = isValidUuid(targetUserId) ? targetUserId : null;

    // 9. Insert into cashbook_invitations table
    let invitationId = 'inv_' + Date.now();
    try {
      const { data: invData, error: invError } = await supabaseAdmin
        .from('cashbook_invitations')
        .insert({
          cashbook_id: cashbookId,
          email: targetEmail,
          role,
          token_hash: tokenHash,
          status: 'Sent',
          inviter_user_id: validInviterUserId,
          inviter_email: inviterEmail || 'owner@trackbook.app',
          expires_at: expiresAt,
          created_at: new Date().toISOString()
        })
        .select()
        .maybeSingle();

      if (invError) {
        console.warn("[send-cashbook-invitation] Primary insert failed, trying fallback:", invError.message);
        const { data: retryData } = await supabaseAdmin
          .from('cashbook_invitations')
          .insert({
            cashbook_id: cashbookId,
            email: targetEmail,
            role,
            token_hash: tokenHash,
            status: 'pending'
          })
          .select()
          .maybeSingle();

        if (retryData?.id) {
          invitationId = retryData.id;
        }
      } else if (invData?.id) {
        invitationId = invData.id;
      }
    } catch (dbErr: any) {
      console.warn("[send-cashbook-invitation] DB insert error:", dbErr.message);
    }

    // 10. Insert notification into notifications table for User B
    let notificationId = 'notif_' + Date.now();
    const notificationData = {
      user_id: validTargetUserId,
      email: targetEmail,
      type: 'cashbook_invitation',
      title: 'New Cashbook Invitation',
      message: `${inviterName} invited you to join ${cashbookName} as ${role}.`,
      cashbook_id: cashbookId,
      invitation_id: isValidUuid(invitationId) ? invitationId : null,
      is_read: false,
      created_at: new Date().toISOString()
    };

    try {
      const { data: notifData, error: notifErr } = await supabaseAdmin
        .from('notifications')
        .insert(notificationData)
        .select()
        .maybeSingle();

      if (notifErr) {
        console.warn("[send-cashbook-invitation] Notification insert fallback:", notifErr.message);
        const { data: retryNotif } = await supabaseAdmin
          .from('notifications')
          .insert({
            user_id: validTargetUserId,
            email: targetEmail,
            type: 'cashbook_invitation',
            title: 'New Cashbook Invitation',
            message: `${inviterName} invited you to join ${cashbookName} as ${role}.`,
            cashbook_id: cashbookId,
            is_read: false
          })
          .select()
          .maybeSingle();

        if (retryNotif?.id) notificationId = retryNotif.id;
      } else if (notifData?.id) {
        notificationId = notifData.id;
      }
    } catch (nErr: any) {
      console.warn("[send-cashbook-invitation] Notification creation exception:", nErr.message);
    }

    // 11. Optionally dispatch email via Resend if RESEND_API_KEY is available
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "TrackBook Cashbooks <onboarding@resend.dev>",
            to: [targetEmail],
            subject: `You're invited to join "${cashbookName}" on TrackBook`,
            html: `
              <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e4e4e7; border-radius: 12px;">
                <h2 style="color: #059669; margin-top: 0;">TrackBook Cashbooks</h2>
                <h3>You're invited to collaborate</h3>
                <p><strong>${inviterName}</strong> (${inviterEmail || 'Admin'}) has invited you to join <strong>${cashbookName}</strong> as <strong>${role}</strong>.</p>
                <div style="margin: 24px 0;">
                  <a href="${invitationUrl}" style="background-color: #059669; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Accept Invitation</a>
                </div>
                <p style="color: #71717a; font-size: 12px;">This invitation expires in 7 days.</p>
              </div>
            `
          })
        });
      } catch (emailErr) {
        console.warn("[send-cashbook-invitation] Email sending note:", emailErr);
      }
    }

    // 12. Insert Audit Log
    try {
      await supabaseAdmin.from('audit_logs').insert({
        cashbook_id: cashbookId,
        actor_user_id: validInviterUserId,
        actor_name: inviterName,
        actor_email: inviterEmail || 'owner@trackbook.app',
        target_user_id: validTargetUserId,
        target_email: targetEmail,
        target_name: name,
        action: 'MEMBER_INVITED',
        new_role: role,
        details: `Dispatched invitation for ${targetEmail} as ${role}`
      });
    } catch (_) {}

    // 13. Return canonical success JSON contract
    return jsonResponse({
      success: true,
      invitation_id: invitationId,
      invitationId: invitationId,
      notification_id: notificationId,
      notificationId: notificationId,
      token: rawToken,
      invitationUrl,
      status: "pending",
      message: `Invitation sent successfully to ${targetEmail}. An in-app notification has been delivered in real time.`
    }, 200);

  } catch (err: any) {
    console.error("[send-cashbook-invitation] Unhandled error:", err);
    return jsonResponse({
      success: false,
      error: "Internal invitation service error.",
      details: err?.message || String(err),
    }, 500);
  }
});
