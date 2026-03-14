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

    // Limit to MAX_PHOTOS_PER_EXECUTION
    const photos = allPhotos.slice(0, MAX_PHOTOS_PER_EXECUTION);
    const remaining = allPhotos.length - photos.length;

    let totalIndexed = 0;
    let totalFaces = 0;

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
            // Use upsert with unique constraint to prevent duplicates
            const { error: insertError } = await supabase
              .from("face_descriptors")
              .upsert(descriptorsToInsert, { onConflict: "photo_id,face_index" });

            if (insertError) {
              console.error("Insert error:", insertError);
            } else {
              totalFaces += descriptorsToInsert.length;
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
