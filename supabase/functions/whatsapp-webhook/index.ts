import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  const url = new URL(req.url);

  // 1. GET: Webhook Verification challenge from Meta
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const VERIFY_TOKEN = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN") || "trackbook_verify_token";

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("[WhatsApp Webhook]: Verification challenge succeeded.");
      return new Response(challenge, { status: 200 });
    } else {
      console.warn("[WhatsApp Webhook]: Verification challenge failed. Tokens did not match.");
      return new Response("Forbidden", { status: 403 });
    }
  }

  // 2. POST: Webhook Status Updates from Meta Cloud API
  if (req.method === "POST") {
    try {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://chbbaswtawmbmyquoiac.supabase.co";
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";

      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const body = await req.json().catch(() => ({}));

      if (body.object === "whatsapp_business_account") {
        const entries = body.entry || [];
        for (const entry of entries) {
          const changes = entry.changes || [];
          for (const change of changes) {
            const value = change.value || {};
            const statuses = value.statuses || [];

            for (const statusObj of statuses) {
              const messageId = statusObj.id; // e.g., wamid.HBgM...
              const deliveryStatus = statusObj.status; // sent, delivered, read, failed
              const errors = statusObj.errors;

              console.log(`[WhatsApp Webhook Status Update]: Message ID: ${messageId} | Status: ${deliveryStatus}`);

              if (messageId && deliveryStatus) {
                const updatePayload: any = {
                  status: deliveryStatus,
                  updated_at: new Date().toISOString()
                };

                if (errors && errors.length > 0) {
                  updatePayload.error_message = JSON.stringify(errors[0]);
                }

                const { error: updateError } = await supabaseAdmin
                  .from("whatsapp_messages")
                  .update(updatePayload)
                  .eq("message_id", messageId);

                if (updateError) {
                  console.warn(`[Webhook DB Update Error for ${messageId}]:`, updateError);
                }
              }
            }
          }
        }
      }

      return new Response(JSON.stringify({ status: "EVENT_RECEIVED" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err: any) {
      console.error("[WhatsApp Webhook Error]:", err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
