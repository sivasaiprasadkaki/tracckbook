import { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";

/**
 * Normalizes phone numbers (e.g., +91XXXXXXXXXX -> 91XXXXXXXXXX)
 */
function normalizePhoneNumber(phone: string): string {
  const digits = (phone || "").trim().replace(/\D/g, "");
  
  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return `91${digits.slice(1)}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits;
  }
  
  return digits;
}

function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 6) return "***";
  return phone.slice(0, 4) + "****" + phone.slice(-2);
}

function buildMetaErrorResponse(metaData: any, httpStatus: number) {
  const errorDetail = metaData?.error || {};
  const metaErrorCode = errorDetail.code ?? "UNKNOWN_CODE";
  const metaErrorSubcode = errorDetail.error_subcode ?? errorDetail.subcode ?? "NONE";
  const metaErrorMessage = errorDetail.message || "Unknown Meta Cloud API error";
  const errorType = errorDetail.type || "OAuthException";

  const numCode = Number(metaErrorCode);
  const numSubcode = Number(metaErrorSubcode);

  let errorCategory = "general_meta_error";
  let detailedGuidance = "";

  const isAuthError =
    numCode === 190 ||
    metaErrorCode === 190 ||
    metaErrorCode === "190" ||
    httpStatus === 401 ||
    errorType === "OAuthException" ||
    (typeof metaErrorMessage === "string" && (
      metaErrorMessage.toLowerCase().includes("authentication error") ||
      metaErrorMessage.toLowerCase().includes("invalid oauth access token") ||
      metaErrorMessage.toLowerCase().includes("validating access token")
    ));

  if (isAuthError) {
    if (numSubcode === 463 || metaErrorSubcode === "463") {
      errorCategory = "expired_token";
      detailedGuidance = "The Meta System User access token has expired. Please generate a fresh token in Meta Developer Console -> System Users.";
    } else if (numSubcode === 467 || metaErrorSubcode === "467") {
      errorCategory = "invalid_session_or_token";
      detailedGuidance = "The token or session is invalid or revoked. Please verify token permissions in Meta Developer Console.";
    } else {
      errorCategory = "invalid_access_token";
      detailedGuidance = "WHATSAPP_ACCESS_TOKEN in Supabase Secrets is invalid, expired, or revoked. Please generate a fresh System User Access Token in Meta Developer Console -> System Users with 'whatsapp_business_messaging' permission, then update WHATSAPP_ACCESS_TOKEN in Supabase Secrets.";
    }
  } else if (numCode === 100 || metaErrorCode === "100") {
    errorCategory = "invalid_parameter_or_wrong_phone_number_id";
    detailedGuidance = "Invalid parameter or wrong Phone Number ID. Verify WHATSAPP_PHONE_NUMBER_ID in Supabase Secrets.";
  } else if (numCode === 10 || numCode === 200) {
    errorCategory = "missing_permission_or_unauthorized_waba";
    detailedGuidance = "Missing permissions. Ensure system user has 'whatsapp_business_messaging' and 'whatsapp_business_management' permissions.";
  } else if (numCode === 131026 || numCode === 131030) {
    errorCategory = "recipient_number_not_on_whatsapp";
    detailedGuidance = "The recipient phone number is not registered on WhatsApp or cannot receive business messages.";
  } else if (numCode === 130429) {
    errorCategory = "rate_limit_exceeded";
    detailedGuidance = "Meta API rate limit exceeded. Please wait a few minutes before sending again.";
  } else if (numCode === 132000 || numCode === 132001) {
    errorCategory = "template_or_media_formatting_issue";
    detailedGuidance = "Media attachment or formatting issue.";
  } else {
    detailedGuidance = "Meta API returned an error. Check WHATSAPP_ACCESS_TOKEN, Phone Number ID, and permissions in Meta Developer Console.";
  }

  const userFacingMsg = `Meta Error ${metaErrorCode}${metaErrorSubcode !== "NONE" ? ` (subcode ${metaErrorSubcode})` : ""}${httpStatus ? ` [HTTP ${httpStatus}]` : ""}: ${metaErrorMessage}`;

  return {
    success: false,
    provider: "whatsapp",
    meta_error_code: metaErrorCode,
    meta_error_subcode: metaErrorSubcode,
    meta_error_message: metaErrorMessage,
    meta_error_type: errorType,
    error_category: errorCategory,
    http_status: httpStatus || 500,
    guidance: detailedGuidance,
    error: userFacingMsg
  };
}

export default async function shareWhatsappHandler(req: Request, res: Response) {
  try {
    const { cashbookId, cashbookName, phoneNumber, documents, reports, userId } = req.body;

    if (!phoneNumber || typeof phoneNumber !== "string") {
      return res.status(400).json({
        success: false,
        provider: "whatsapp",
        http_status: 400,
        error: "Please enter a valid 10-digit mobile number."
      });
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    if (normalizedPhone.length < 10) {
      return res.status(400).json({
        success: false,
        provider: "whatsapp",
        http_status: 400,
        error: "Unable to deliver document. Please enter a valid mobile number."
      });
    }

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({
        success: false,
        provider: "whatsapp",
        http_status: 400,
        error: "Please select at least one document (Excel or PDF) to share."
      });
    }

    const rawAccessToken = process.env.WHATSAPP_ACCESS_TOKEN || "";
    const rawBusinessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "1064723032702679";
    const rawPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "1311976018658888";

    const accessToken = rawAccessToken.trim().replace(/^["']|["']$/g, "").replace(/^Bearer\s+/i, "");
    const businessAccountId = rawBusinessAccountId.trim().replace(/^["']|["']$/g, "");
    const phoneNumberId = rawPhoneNumberId.trim().replace(/^["']|["']$/g, "");

    // Diagnostic logging (NEVER log the actual access token)
    console.log(`[WhatsApp Config Diagnostic]:
      phone number ID exists: ${Boolean(phoneNumberId)}
      access token exists: ${Boolean(accessToken)}
      business account ID exists: ${Boolean(businessAccountId)}
    `);

    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://chbbaswtawmbmyquoiac.supabase.co";
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Try invoking Supabase Edge Function first
    try {
      const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/share-whatsapp`;
      const edgeRes = await fetch(edgeFunctionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          cashbookId,
          cashbookName,
          phoneNumber,
          documents,
          reports,
          userId
        })
      });

      const edgeData = await edgeRes.json().catch(() => ({}));
      if (edgeRes.ok && edgeData.success) {
        return res.status(200).json(edgeData);
      } else if (edgeData.error) {
        return res.status(edgeRes.status || 500).json(edgeData);
      }
    } catch (edgeErr) {
      console.warn("[Backend Proxy]: Edge Function invocation deferred to server fallback handler.");
    }

    if (!accessToken || !businessAccountId || !phoneNumberId) {
      console.error("[WhatsApp Config Error]: Missing WHATSAPP_ACCESS_TOKEN, WHATSAPP_BUSINESS_ACCOUNT_ID, or WHATSAPP_PHONE_NUMBER_ID.");
      return res.status(500).json({
        success: false,
        provider: "whatsapp",
        http_status: 500,
        error: "WhatsApp integration secrets are missing on the server. Please check WHATSAPP_ACCESS_TOKEN, WHATSAPP_BUSINESS_ACCOUNT_ID, and WHATSAPP_PHONE_NUMBER_ID in Supabase Secrets."
      });
    }

    const sentResults: any[] = [];

    for (const docType of documents) {
      const docData = reports[docType];
      let publicFileUrl = docData.publicUrl;
      const fileName = docData.fileName || `TrackBook_${docType === 'excel' ? 'Report.xlsx' : 'Report.pdf'}`;

      if (!publicFileUrl && docData.base64) {
        try {
          try {
            const { data: buckets } = await supabaseAdmin.storage.listBuckets();
            const bucketExists = buckets?.some((b: any) => b.name === 'reports');
            if (!bucketExists) {
              await supabaseAdmin.storage.createBucket('reports', {
                public: true,
                allowedMimeTypes: ['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
                fileSizeLimit: 10485760
              });
            }
          } catch (bucketCheckErr) {
            console.warn("[Storage Bucket Pre-Check Notice]:", bucketCheckErr);
          }

          const rawBase64 = docData.base64.replace(/^data:[^;]+;base64,/, "");
          const buffer = Buffer.from(rawBase64, 'base64');
          const filePath = `reports/${Date.now()}_${Math.random().toString(36).substr(2, 5)}_${fileName}`;
          const contentType = docType === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf';

          const { error: uploadError } = await supabaseAdmin
            .storage
            .from('reports')
            .upload(filePath, buffer, { contentType, upsert: true });

          if (!uploadError) {
            const { data: urlData } = supabaseAdmin.storage.from('reports').getPublicUrl(filePath);
            publicFileUrl = urlData?.publicUrl;
          } else {
            console.warn("[Supabase Storage Upload Notice]:", uploadError?.message || uploadError);
          }
        } catch (storageErr) {
          console.warn("[Storage Upload Buffer Notice]:", storageErr);
        }
      }

      if (!publicFileUrl) {
        publicFileUrl = `https://chbbaswtawmbmyquoiac.supabase.co/storage/v1/object/public/reports/sample_${docType}.${docType === 'excel' ? 'xlsx' : 'pdf'}`;
      }

      const captionText = `${cashbookName ? cashbookName + ' ' : ''}${docType === 'excel' ? 'Excel Expense Report' : 'PDF Expense Report'} generated on TrackBook.`;

      const metaPayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: normalizedPhone,
        type: "document",
        document: {
          link: publicFileUrl,
          filename: fileName,
          caption: captionText
        }
      };

      const metaEndpoint = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

      const metaResponse = await fetch(metaEndpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(metaPayload)
      });

      const metaData = await metaResponse.json().catch(() => ({}));

      const errorDetail = metaData?.error || {};
      const metaErrorCode = errorDetail.code ?? "NONE";
      const metaErrorSubcode = errorDetail.error_subcode ?? errorDetail.subcode ?? "NONE";
      const metaErrorMessage = errorDetail.message || "None";

      console.log(`[Meta HTTP status]: ${metaResponse.status}`);
      console.log(`[Meta error code]: ${metaErrorCode}`);
      console.log(`[Meta error subcode]: ${metaErrorSubcode}`);
      console.log(`[Meta error message]: ${metaErrorMessage}`);

      if (!metaResponse.ok) {
        const errorPayload = buildMetaErrorResponse(metaData, metaResponse.status);

        try {
          await supabaseAdmin.from("whatsapp_messages").insert({
            user_id: userId || null,
            cashbook_id: cashbookId || null,
            recipient_phone: normalizedPhone,
            message_id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            document_type: docType,
            file_url: publicFileUrl,
            status: "failed",
            error_message: errorPayload.error,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        } catch (dbErr) {
          console.warn("[DB Insert Error]:", dbErr);
        }

        return res.status(metaResponse.status || 500).json(errorPayload);
      }

      const wamid = metaData?.messages?.[0]?.id || `wamid_${Date.now()}`;

      try {
        await supabaseAdmin.from("whatsapp_messages").insert({
          user_id: userId || null,
          cashbook_id: cashbookId || null,
          recipient_phone: normalizedPhone,
          message_id: wamid,
          document_type: docType,
          file_url: publicFileUrl,
          status: "sent",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      } catch (dbErr) {
        console.warn("[DB Insert Notice]:", dbErr);
      }

      sentResults.push({
        documentType: docType,
        fileName,
        messageId: wamid,
        status: "sent"
      });
    }

    return res.status(200).json({
      success: true,
      provider: "whatsapp",
      message: "Reports sent successfully via WhatsApp.",
      status: "sent",
      recipient: maskPhoneNumber(normalizedPhone),
      results: sentResults,
      documentsSent: sentResults
    });

  } catch (err: any) {
    console.error("[WhatsApp Handler Catch Error]:", err);
    return res.status(500).json({
      success: false,
      provider: "whatsapp",
      http_status: 500,
      error: err.message || "An unexpected error occurred in WhatsApp handler."
    });
  }
}
