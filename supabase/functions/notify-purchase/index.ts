import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { purchaseRequestId } = await req.json();

    if (!purchaseRequestId) {
      return new Response(
        JSON.stringify({ error: "purchaseRequestId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get purchase request details
    const { data: purchase, error: purchaseError } = await supabase
      .from("purchase_requests")
      .select("*")
      .eq("id", purchaseRequestId)
      .single();

    if (purchaseError || !purchase) {
      throw new Error("Purchase request not found");
    }

    // Get event details and admin email
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("name, code, admin_id")
      .eq("id", purchase.event_id)
      .single();

    if (eventError || !event) {
      throw new Error("Event not found");
    }

    // Get admin email from auth
    const { data: { user: adminUser }, error: userError } = await supabase.auth.admin.getUserById(event.admin_id);

    if (userError || !adminUser?.email) {
      throw new Error("Admin user not found");
    }

    const photoCount = purchase.photo_ids?.length ?? 0;
    const totalAmount = Number(purchase.total_amount).toFixed(2);

    // Send email via Resend
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Plusspaz <onboarding@resend.dev>",
        to: [adminUser.email],
        subject: `💰 Nueva compra — ${event.name}`,
        html: `
          <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <div style="background: #1a1a2e; border-radius: 12px; padding: 24px; color: #f5f0e8;">
              <h1 style="font-size: 20px; margin: 0 0 16px; color: #e8a838;">
                Nueva solicitud de compra
              </h1>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #8a8a9a; font-size: 14px;">Evento</td>
                  <td style="padding: 8px 0; text-align: right; font-size: 14px; color: #f5f0e8;">${event.name} (${event.code})</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #8a8a9a; font-size: 14px;">Cliente</td>
                  <td style="padding: 8px 0; text-align: right; font-size: 14px; color: #f5f0e8;">${purchase.client_name || "Sin nombre"}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #8a8a9a; font-size: 14px;">Teléfono</td>
                  <td style="padding: 8px 0; text-align: right; font-size: 14px; color: #f5f0e8;">${purchase.client_phone || "No proporcionado"}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #8a8a9a; font-size: 14px;">Fotos</td>
                  <td style="padding: 8px 0; text-align: right; font-size: 14px; color: #f5f0e8;">${photoCount} foto${photoCount > 1 ? "s" : ""}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #8a8a9a; font-size: 14px;">Método</td>
                  <td style="padding: 8px 0; text-align: right; font-size: 14px; color: #f5f0e8;">${purchase.payment_method.toUpperCase()}</td>
                </tr>
                <tr style="border-top: 1px solid #2a2a3e;">
                  <td style="padding: 12px 0 0; color: #e8a838; font-size: 16px; font-weight: bold;">Total</td>
                  <td style="padding: 12px 0 0; text-align: right; font-size: 16px; font-weight: bold; color: #e8a838;">$${totalAmount}</td>
                </tr>
              </table>
              <p style="margin: 20px 0 0; font-size: 13px; color: #8a8a9a; text-align: center;">
                Ingresa al panel admin de Plusspaz para aprobar o rechazar esta solicitud.
              </p>
            </div>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend error:", emailResponse.status, errorText);
      throw new Error(`Failed to send email: ${emailResponse.status}`);
    }

    const emailData = await emailResponse.json();

    return new Response(
      JSON.stringify({ success: true, emailId: emailData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("notify-purchase error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
