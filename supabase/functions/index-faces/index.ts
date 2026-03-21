import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_PHOTOS_PER_EXECUTION = 200;
const BATCH_SIZE = 4;
const AI_TIMEOUT_MS = 45000;

// Convert text descriptor to 32-dim feature vector (deterministic, no AI cost)
function descriptorToVector(descriptor: string): number[] {
  const d = descriptor.toLowerCase();
  const v = new Array(32).fill(0);

  // Age (0-4)
  if (/child|kid|boy\b|girl\b|infant|baby|\b[0-9]\b|1[0-2]\b/.test(d)) v[0] = 1;
  if (/teen|adolescent|1[3-9]\b/.test(d)) v[1] = 1;
  if (/20s|young|2[0-9]|3[0-5]|twenties|thirties/.test(d)) v[2] = 1;
  if (/40s|middle|3[6-9]|4[0-9]|5[0-5]|forties|fifties/.test(d)) v[3] = 1;
  if (/senior|elder|old|6[0-9]|7[0-9]|80|sixties|seventies/.test(d)) v[4] = 1;

  // Gender (5-6)
  if (/\bmale\b|\bman\b|\bhombre\b|\bmasculin/.test(d)) v[5] = 1;
  if (/female|woman|mujer|femenin/.test(d)) v[6] = 1;

  // Skin tone (7-11)
  if (/very light|very fair|pale|muy clar/.test(d)) v[7] = 1;
  if (/\blight\b|\bfair\b|\bclar[ao]?\b/.test(d)) v[8] = 1;
  if (/medium|olive|tan|moren[ao]|trigueñ/.test(d)) v[9] = 1;
  if (/\bdark\b|brown skin|oscur/.test(d)) v[10] = 1;
  if (/very dark|deep|muy oscur/.test(d)) v[11] = 1;

  // Hair color (12-17)
  if (/black hair|pelo negro|cabello negro|dark hair/.test(d)) v[12] = 1;
  if (/brown hair|brunette|castaño|cabello café/.test(d)) v[13] = 1;
  if (/blonde|blond|rubio|rubia/.test(d)) v[14] = 1;
  if (/red hair|ginger|pelirroj/.test(d)) v[15] = 1;
  if (/gray|grey|white hair|canas|canoso|plateado/.test(d)) v[16] = 1;
  if (/bald|calvo|shaved head|rapado/.test(d)) v[17] = 1;

  // Hair length (18-20)
  if (/short hair|pelo corto|cabello corto/.test(d)) v[18] = 1;
  if (/medium.{0,8}hair|shoulder|medio/.test(d)) v[19] = 1;
  if (/long hair|pelo largo|cabello largo/.test(d)) v[20] = 1;

  // Facial hair (21-23)
  if (/no facial hair|clean.shaven|sin barba|lampiño/.test(d)) v[21] = 1;
  if (/mustache|bigote|stubble/.test(d)) v[22] = 1;
  if (/beard|barba|goatee|barbudo/.test(d)) v[23] = 1;

  // Glasses (24-25)
  if (/no glasses|sin lentes|sin gafas|without glass/.test(d)) v[24] = 1;
  if (/glasses|lentes|gafas|spectacles|anteojos/.test(d)) v[25] = 1;

  // Expression (26-27)
  if (/smiling|smile|sonriendo|sonrisa/.test(d)) v[26] = 1;
  if (/serious|neutral|serio/.test(d)) v[27] = 1;

  // Face shape (28-30)
  if (/round|redond/.test(d)) v[28] = 1;
  if (/oval|ovalad/.test(d)) v[29] = 1;
  if (/square|angular|cuadrad/.test(d)) v[30] = 1;

  // Distinctive features (31)
  if (/freckles|dimple|scar|tattoo|piercing|pecas|lunar|cicatriz/.test(d)) v[31] = 1;

  // Normalize
  const magnitude = Math.sqrt(v.reduce((sum: number, x: number) => sum + x * x, 0)) || 1;
  return v.map((x: number) => Math.round((x / magnitude) * 10000) / 10000);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { eventId, photoIds } = await req.json();

    if (!eventId) {
      return new Response(
        JSON.stringify({ error: "eventId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get unindexed photos
    let query = supabase
      .from("event_photos")
      .select("id, storage_path")
      .eq("event_id", eventId)
      .eq("is_indexed", false);

    if (photoIds && Array.isArray(photoIds) && photoIds.length > 0) {
      query = query.in("id", photoIds);
    }

    const { data: allPhotos, error: photosError } = await query.order("created_at", { ascending: true });

    if (photosError) {
      console.error("Error fetching photos:", photosError);
      return new Response(
        JSON.stringify({ error: "Error fetching photos" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!allPhotos || allPhotos.length === 0) {
      return new Response(
        JSON.stringify({ indexed: 0, message: "No unindexed photos found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const photos = allPhotos.slice(0, MAX_PHOTOS_PER_EXECUTION);
    const remaining = allPhotos.length - photos.length;

    let totalIndexed = 0;
    let totalFaces = 0;
    let totalEmbeddings = 0;

    for (let i = 0; i < photos.length; i += BATCH_SIZE) {
      const batch = photos.slice(i, i + BATCH_SIZE);

      const photosWithUrls = batch.map((p) => {
        const { data } = supabase.storage.from("event-photos").getPublicUrl(p.storage_path);
        return { id: p.id, url: data.publicUrl };
      });

      const photoDescriptions = photosWithUrls.map((p, idx) => `Photo ${idx + 1} (ID: ${p.id})`).join(", ");
      const imageContents = photosWithUrls.map((p) => ({
        type: "image_url" as const,
        image_url: { url: p.url },
      }));

      const messages = [
        {
          role: "system",
          content: `Extract face descriptors from photos. For each visible face return a JSON object.

Keep each descriptor UNDER 25 WORDS with ONLY these attributes:
age range, gender, skin tone, hair color/style, facial hair, glasses, one distinctive feature.

Example descriptor: "Male, 30s, medium skin, short black hair, no facial hair, glasses, smiling"

Return ONLY a JSON array: [{"photoId":"uuid","faceIndex":0,"descriptor":"..."}]
If no faces, return [].

Photos: ${photoDescriptions}`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract faces:" },
            ...imageContents,
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
          body: JSON.stringify({ model: "google/gemini-2.5-flash", messages, max_tokens: 1500 }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error(`AI error (batch ${i}):`, aiResponse.status, errorText);
          if (aiResponse.status === 429) {
            return new Response(
              JSON.stringify({ error: "Rate limit. Intenta en unos segundos.", indexed: totalIndexed, remaining: photos.length - i + remaining }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (aiResponse.status === 402) {
            return new Response(
              JSON.stringify({ error: "Créditos de IA agotados.", indexed: totalIndexed }),
              { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          continue;
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || "[]";
        const faceEntries = safeParseJsonArray(content);

        if (faceEntries.length > 0) {
          const descriptorsToInsert = faceEntries
            .filter((f: any) => f.photoId && f.descriptor)
            .map((f: any) => ({
              event_id: eventId,
              photo_id: f.photoId,
              face_index: f.faceIndex ?? 0,
              descriptor: f.descriptor,
            }));

          if (descriptorsToInsert.length > 0) {
            const { error: insertError } = await supabase
              .from("face_descriptors")
              .upsert(descriptorsToInsert, { onConflict: "photo_id,face_index" });

            if (insertError) {
              console.error("Descriptor insert error:", insertError);
            } else {
              totalFaces += descriptorsToInsert.length;
            }

            // --- EMBEDDING GENERATION (deterministic, no AI cost) ---
            const embeddingsToInsert = descriptorsToInsert
              .map((d: any) => {
                const vector = descriptorToVector(d.descriptor);
                return {
                  event_id: eventId,
                  photo_id: d.photo_id,
                  face_index: d.face_index,
                  embedding: `[${vector.join(",")}]`,
                };
              });

            const { error: embError } = await supabase
              .from("face_embeddings")
              .upsert(embeddingsToInsert, { onConflict: "photo_id,face_index" });

            if (embError) {
              console.error("Embedding insert error:", embError);
            } else {
              totalEmbeddings += embeddingsToInsert.length;
              console.log(`Generated ${embeddingsToInsert.length} embeddings for batch ${i}`);
            }
          }
        }
      } catch (batchError) {
        if (batchError instanceof DOMException && batchError.name === "AbortError") {
          console.error(`AI timeout on batch ${i}`);
        } else {
          console.error(`Batch ${i} error:`, batchError);
        }
        continue;
      }

      // Mark batch as indexed
      const batchIds = batch.map((p) => p.id);
      await supabase.from("event_photos").update({ is_indexed: true }).in("id", batchIds);
      totalIndexed += batch.length;
    }

    return new Response(
      JSON.stringify({
        indexed: totalIndexed,
        faces: totalFaces,
        embeddings: totalEmbeddings,
        ...(remaining > 0 ? { remaining, message: `Quedan ${remaining} fotos por indexar. Ejecuta de nuevo.` } : {}),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("index-faces error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function safeParseJsonArray(content: string): any[] {
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
