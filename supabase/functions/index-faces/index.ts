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

    // Get photos to index (either specific photoIds or all unindexed)
    let query = supabase
      .from("event_photos")
      .select("id, storage_path")
      .eq("event_id", eventId)
      .eq("is_indexed", false);

    if (photoIds && Array.isArray(photoIds) && photoIds.length > 0) {
      query = query.in("id", photoIds);
    }

    const { data: photos, error: photosError } = await query.order("created_at", { ascending: true });

    if (photosError) {
      console.error("Error fetching photos:", photosError);
      return new Response(
        JSON.stringify({ error: "Error fetching photos" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!photos || photos.length === 0) {
      return new Response(
        JSON.stringify({ indexed: 0, message: "No unindexed photos found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process in batches of 4
    const BATCH_SIZE = 4;
    let totalIndexed = 0;
    let totalFaces = 0;

    for (let i = 0; i < photos.length; i += BATCH_SIZE) {
      const batch = photos.slice(i, i + BATCH_SIZE);

      // Get public URLs
      const photosWithUrls = batch.map((p) => {
        const { data } = supabase.storage.from("event-photos").getPublicUrl(p.storage_path);
        return { id: p.id, url: data.publicUrl };
      });

      const photoDescriptions = photosWithUrls
        .map((p, idx) => `Photo ${idx + 1} (ID: ${p.id})`)
        .join(", ");

      const imageContents = photosWithUrls.map((p) => ({
        type: "image_url" as const,
        image_url: { url: p.url },
      }));

      const messages = [
        {
          role: "system",
          content: `You are a face descriptor extractor. You analyze photos and describe every visible human face in detail.

For each photo, describe EVERY face you can see. For each face provide:
- photoId: the photo ID string
- faceIndex: 0-based index of the face in that photo
- descriptor: A detailed text description of the person's face including:
  * Approximate age range (child/teen/20s/30s/40s/50s/60s+)
  * Gender presentation (male/female)
  * Skin tone (light/medium/tan/dark)
  * Hair: color, length, style (short/long/curly/straight/bald/tied)
  * Facial hair (none/mustache/beard/goatee)
  * Glasses (none/glasses/sunglasses)
  * Face shape (round/oval/square/long)
  * Distinctive features (freckles, dimples, prominent features)
  * Expression (smiling/serious/laughing)
  * What they are wearing (hat, helmet, shirt color if visible)
  * Position in photo (left/center/right, foreground/background)

Return ONLY a JSON array of objects with: photoId (string), faceIndex (number), descriptor (string).
If no faces are visible in a photo, don't include entries for it.
Return ONLY the JSON array, no other text.

The photos are: ${photoDescriptions}`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze all faces in these event photos:" },
            ...imageContents,
          ],
        },
      ];

      const aiResponse = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages,
            max_tokens: 2000,
          }),
        }
      );

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error(`AI error (batch ${i}):`, aiResponse.status, errorText);
        if (aiResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit. Intenta en unos segundos.", indexed: totalIndexed }),
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

      try {
        let jsonStr = content.trim();
        if (jsonStr.startsWith("```")) {
          jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
        }
        const faceEntries = JSON.parse(jsonStr);

        if (Array.isArray(faceEntries)) {
          // Insert face descriptors
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
              .insert(descriptorsToInsert);

            if (insertError) {
              console.error("Insert error:", insertError);
            } else {
              totalFaces += descriptorsToInsert.length;
            }
          }
        }
      } catch (parseError) {
        console.error("Parse error:", content, parseError);
      }

      // Mark batch photos as indexed
      const batchIds = batch.map((p) => p.id);
      await supabase
        .from("event_photos")
        .update({ is_indexed: true })
        .in("id", batchIds);

      totalIndexed += batch.length;
    }

    return new Response(
      JSON.stringify({ indexed: totalIndexed, faces: totalFaces }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("index-faces error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
