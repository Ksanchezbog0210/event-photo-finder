import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_SEARCHES_PER_EVENT = 3;
const CHUNK_SIZE = 200;
const AI_TIMEOUT_MS = 30000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { selfieBase64, eventId } = await req.json();

    if (!selfieBase64 || !eventId) {
      return new Response(
        JSON.stringify({ error: "selfieBase64 and eventId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // --- RATE LIMITING ---
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
      || req.headers.get("cf-connecting-ip") 
      || "unknown";

    const { data: rateData } = await supabase
      .from("search_rate_limits")
      .select("search_count")
      .eq("event_id", eventId)
      .eq("client_ip", clientIp)
      .maybeSingle();

    if (rateData && rateData.search_count >= MAX_SEARCHES_PER_EVENT) {
      return new Response(
        JSON.stringify({ error: "Has alcanzado el límite de búsquedas para este evento.", rateLimited: true }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- GET DESCRIPTORS ---
    const { data: descriptors, error: descError } = await supabase
      .from("face_descriptors")
      .select("id, photo_id, face_index, descriptor")
      .eq("event_id", eventId)
      .order("photo_id")
      .order("face_index");

    if (descError || !descriptors || descriptors.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Las fotos de este evento aún no han sido procesadas. El fotógrafo debe indexar las fotos primero.",
          matches: [],
          notIndexed: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- CHUNK DESCRIPTORS & CALL AI ---
    const allMatches = new Map<string, number>();

    for (let i = 0; i < descriptors.length; i += CHUNK_SIZE) {
      const chunk = descriptors.slice(i, i + CHUNK_SIZE);
      const faceCatalog = chunk
        .map((d, idx) => `F${idx + 1}|${d.photo_id}|${d.face_index}|${d.descriptor}`)
        .join("\n");

      const messages = [
        {
          role: "system",
          content: `You are a face matcher. Compare the selfie against this face catalog and find matches.

RULES:
- Match on: age, gender, skin tone, hair, glasses, facial hair, distinctive features
- Score 0.9+: very confident. 0.7-0.9: likely. 0.5-0.7: possible. Only include >= 0.5
- Group by photoId, keep highest score per photo
- Return ONLY a JSON array: [{"photoId":"uuid","score":0.85}]
- If no matches return []

CATALOG:
${faceCatalog}`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Find me in the catalog:" },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${selfieBase64}` } },
          ],
        },
      ];

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model: "google/gemini-2.5-flash", messages, max_tokens: 1000 }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error(`AI error (chunk ${i}):`, aiResponse.status, errorText);
          if (aiResponse.status === 429) {
            return new Response(
              JSON.stringify({ error: "Demasiadas solicitudes. Intenta de nuevo en unos segundos." }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (aiResponse.status === 402) {
            return new Response(
              JSON.stringify({ error: "Créditos de IA agotados." }),
              { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          continue; // skip this chunk on other errors
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || "[]";
        const parsed = safeParseJsonArray(content);

        for (const match of parsed) {
          if (match.photoId && typeof match.score === "number" && match.score >= 0.5) {
            const existing = allMatches.get(match.photoId) ?? 0;
            if (match.score > existing) allMatches.set(match.photoId, match.score);
          }
        }
      } catch (chunkError) {
        if (chunkError instanceof DOMException && chunkError.name === "AbortError") {
          console.error(`AI timeout on chunk ${i}`);
        } else {
          console.error(`Chunk ${i} error:`, chunkError);
        }
        continue;
      }
    }

    // --- INCREMENT RATE LIMIT ---
    if (rateData) {
      await supabase
        .from("search_rate_limits")
        .update({ search_count: rateData.search_count + 1, last_search_at: new Date().toISOString() })
        .eq("event_id", eventId)
        .eq("client_ip", clientIp);
    } else {
      await supabase.from("search_rate_limits").insert({
        event_id: eventId,
        client_ip: clientIp,
        search_count: 1,
      });
    }

    // --- CLEANUP OLD SEARCH REQUESTS (fire and forget) ---
    supabase.rpc("cleanup_old_search_requests").then(({ data }) => {
      if (data && data > 0) console.log(`Cleaned ${data} old search requests`);
    }).catch(() => {});

    const results = Array.from(allMatches.entries())
      .map(([photoId, score]) => ({ photoId, score }))
      .sort((a, b) => b.score - a.score);

    return new Response(
      JSON.stringify({ matches: results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("face-match error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function safeParseJsonArray(content: string): Array<{ photoId: string; score: number }> {
  try {
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    }
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.error("Failed to parse AI response:", content);
    return [];
  }
}
