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

// Same deterministic vector function as index-faces
function descriptorToVector(descriptor: string): number[] {
  const d = descriptor.toLowerCase();
  const v = new Array(32).fill(0);

  if (/child|kid|boy\b|girl\b|infant|baby|\b[0-9]\b|1[0-2]\b/.test(d)) v[0] = 1;
  if (/teen|adolescent|1[3-9]\b/.test(d)) v[1] = 1;
  if (/20s|young|2[0-9]|3[0-5]|twenties|thirties/.test(d)) v[2] = 1;
  if (/40s|middle|3[6-9]|4[0-9]|5[0-5]|forties|fifties/.test(d)) v[3] = 1;
  if (/senior|elder|old|6[0-9]|7[0-9]|80|sixties|seventies/.test(d)) v[4] = 1;

  if (/\bmale\b|\bman\b|\bhombre\b|\bmasculin/.test(d)) v[5] = 1;
  if (/female|woman|mujer|femenin/.test(d)) v[6] = 1;

  if (/very light|very fair|pale|muy clar/.test(d)) v[7] = 1;
  if (/\blight\b|\bfair\b|\bclar[ao]?\b/.test(d)) v[8] = 1;
  if (/medium|olive|tan|moren[ao]|trigueñ/.test(d)) v[9] = 1;
  if (/\bdark\b|brown skin|oscur/.test(d)) v[10] = 1;
  if (/very dark|deep|muy oscur/.test(d)) v[11] = 1;

  if (/black hair|pelo negro|cabello negro|dark hair/.test(d)) v[12] = 1;
  if (/brown hair|brunette|castaño|cabello café/.test(d)) v[13] = 1;
  if (/blonde|blond|rubio|rubia/.test(d)) v[14] = 1;
  if (/red hair|ginger|pelirroj/.test(d)) v[15] = 1;
  if (/gray|grey|white hair|canas|canoso|plateado/.test(d)) v[16] = 1;
  if (/bald|calvo|shaved head|rapado/.test(d)) v[17] = 1;

  if (/short hair|pelo corto|cabello corto/.test(d)) v[18] = 1;
  if (/medium.{0,8}hair|shoulder|medio/.test(d)) v[19] = 1;
  if (/long hair|pelo largo|cabello largo/.test(d)) v[20] = 1;

  if (/no facial hair|clean.shaven|sin barba|lampiño/.test(d)) v[21] = 1;
  if (/mustache|bigote|stubble/.test(d)) v[22] = 1;
  if (/beard|barba|goatee|barbudo/.test(d)) v[23] = 1;

  if (/no glasses|sin lentes|sin gafas|without glass/.test(d)) v[24] = 1;
  if (/glasses|lentes|gafas|spectacles|anteojos/.test(d)) v[25] = 1;

  if (/smiling|smile|sonriendo|sonrisa/.test(d)) v[26] = 1;
  if (/serious|neutral|serio/.test(d)) v[27] = 1;

  if (/round|redond/.test(d)) v[28] = 1;
  if (/oval|ovalad/.test(d)) v[29] = 1;
  if (/square|angular|cuadrad/.test(d)) v[30] = 1;

  if (/freckles|dimple|scar|tattoo|piercing|pecas|lunar|cicatriz/.test(d)) v[31] = 1;

  const magnitude = Math.sqrt(v.reduce((sum: number, x: number) => sum + x * x, 0)) || 1;
  return v.map((x: number) => Math.round((x / magnitude) * 10000) / 10000);
}

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

    // --- CHECK IF EMBEDDINGS EXIST FOR THIS EVENT ---
    const { count: embeddingCount } = await supabase
      .from("face_embeddings")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId);

    let vectorResults: Array<{ photoId: string; score: number }> = [];
    let usedVectorSearch = false;

    // --- STEP 1: TRY VECTOR SIMILARITY SEARCH ---
    if (embeddingCount && embeddingCount > 0) {
      console.log(`[vector-search] Event has ${embeddingCount} embeddings, trying vector search first`);

      try {
        // Get selfie descriptor via AI (1 call instead of N chunks)
        const selfieDescriptor = await getSelfieDescriptor(selfieBase64, LOVABLE_API_KEY);

        if (selfieDescriptor) {
          const selfieVector = descriptorToVector(selfieDescriptor);
          const vectorString = `[${selfieVector.join(",")}]`;

          console.log(`[vector-search] Selfie descriptor: "${selfieDescriptor}"`);

          const { data: vectorMatches, error: vecError } = await supabase
            .rpc("match_face_embeddings", {
              query_embedding: vectorString,
              match_event_id: eventId,
              match_threshold: 0.3,
              match_count: 30,
            });

          if (vecError) {
            console.error("[vector-search] RPC error:", vecError);
          } else if (vectorMatches && vectorMatches.length > 0) {
            console.log(`[vector-search] Found ${vectorMatches.length} vector matches`);
            usedVectorSearch = true;

            // Deduplicate by photoId, keep highest similarity
            const photoMap = new Map<string, number>();
            for (const m of vectorMatches) {
              const existing = photoMap.get(m.photo_id) ?? 0;
              if (m.similarity > existing) photoMap.set(m.photo_id, m.similarity);
            }

            vectorResults = Array.from(photoMap.entries())
              .map(([photoId, score]) => ({ photoId, score }))
              .sort((a, b) => b.score - a.score);
          } else {
            console.log("[vector-search] No vector matches found, falling back to AI matching");
          }
        }
      } catch (vecError) {
        console.error("[vector-search] Error during vector search, falling back:", vecError);
      }
    } else {
      console.log("[vector-search] No embeddings for this event, using AI matching");
    }

    // --- STEP 2: IF VECTOR SEARCH FOUND RESULTS, USE THEM ---
    if (usedVectorSearch && vectorResults.length > 0) {
      // Increment rate limit
      await incrementRateLimit(supabase, eventId, clientIp, rateData);

      // Cleanup old searches (fire and forget)
      supabase.rpc("cleanup_old_search_requests").then(({ data }) => {
        if (data && data > 0) console.log(`Cleaned ${data} old search requests`);
      }).catch(() => {});

      console.log(`[vector-search] Returning ${vectorResults.length} matches (vector search)`);
      return new Response(
        JSON.stringify({ matches: vectorResults, method: "vector" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- STEP 3: FALLBACK TO EXISTING AI DESCRIPTOR MATCHING ---
    console.log("[fallback] Using AI descriptor matching");

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
          continue;
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
    await incrementRateLimit(supabase, eventId, clientIp, rateData);

    // --- CLEANUP OLD SEARCH REQUESTS ---
    supabase.rpc("cleanup_old_search_requests").then(({ data }) => {
      if (data && data > 0) console.log(`Cleaned ${data} old search requests`);
    }).catch(() => {});

    const results = Array.from(allMatches.entries())
      .map(([photoId, score]) => ({ photoId, score }))
      .sort((a, b) => b.score - a.score);

    console.log(`[fallback] Returning ${results.length} matches (AI matching)`);
    return new Response(
      JSON.stringify({ matches: results, method: "ai" }),
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

// Get a text descriptor of the selfie (1 AI call)
async function getSelfieDescriptor(selfieBase64: string, apiKey: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Describe this person's face concisely for matching. Include ONLY: age range, gender, skin tone, hair color/style, facial hair, glasses, one distinctive feature. Keep under 25 words. Return ONLY the description text, no JSON.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Describe this face:" },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${selfieBase64}` } },
            ],
          },
        ],
        max_tokens: 100,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error("[selfie-descriptor] AI error:", response.status);
      return null;
    }

    const data = await response.json();
    const descriptor = data.choices?.[0]?.message?.content?.trim() || null;
    console.log(`[selfie-descriptor] Generated: "${descriptor}"`);
    return descriptor;
  } catch (err) {
    console.error("[selfie-descriptor] Error:", err);
    return null;
  }
}

async function incrementRateLimit(supabase: any, eventId: string, clientIp: string, rateData: any) {
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
}

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
