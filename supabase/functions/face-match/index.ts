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
    const { selfieBase64, eventId } = await req.json();

    if (!selfieBase64 || !eventId) {
      return new Response(
        JSON.stringify({ error: "selfieBase64 and eventId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get event photos
    const { data: photos, error: photosError } = await supabase
      .from("event_photos")
      .select("id, storage_path")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });

    if (photosError || !photos || photos.length === 0) {
      return new Response(
        JSON.stringify({ error: "No photos found for this event", matches: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get public URLs for all photos
    const photosWithUrls = photos.map((p) => {
      const { data } = supabase.storage.from("event-photos").getPublicUrl(p.storage_path);
      return { id: p.id, url: data.publicUrl };
    });

    // Process in batches of 4 photos at a time to avoid token limits
    const BATCH_SIZE = 4;
    const allMatches: { photoId: string; score: number }[] = [];

    for (let i = 0; i < photosWithUrls.length; i += BATCH_SIZE) {
      const batch = photosWithUrls.slice(i, i + BATCH_SIZE);

      const photoDescriptions = batch
        .map((p, idx) => `Photo ${idx + 1} (ID: ${p.id})`)
        .join(", ");

      const imageContents = batch.map((p) => ({
        type: "image_url" as const,
        image_url: { url: p.url },
      }));

      const messages = [
        {
          role: "system",
          content: `You are a face matching assistant. You will receive a selfie photo and ${batch.length} event photos. 
Your task is to determine if the SAME PERSON from the selfie appears in each event photo.

IMPORTANT RULES:
- Compare facial features: face shape, eyes, nose, mouth, skin tone, hair
- A person may look different due to angle, lighting, distance, or activity (sports)
- Be generous with matching - if there's a reasonable chance it's the same person, include it
- Return ONLY a JSON array with objects containing "photoId" (string) and "score" (number 0.0-1.0)
- Score meaning: 0.9+ = very confident match, 0.7-0.9 = likely match, 0.5-0.7 = possible match
- Only include photos with score >= 0.5
- If no matches found, return an empty array []
- Return ONLY the JSON array, no other text

The photos are: ${photoDescriptions}`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "This is my selfie. Find me in the following event photos:" },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${selfieBase64}` },
            },
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
            max_tokens: 500,
          }),
        }
      );

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error(`AI gateway error (batch ${i}):`, aiResponse.status, errorText);
        
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
        // Skip this batch on error, continue with others
        continue;
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content || "[]";

      try {
        // Extract JSON from response (handle markdown code blocks)
        let jsonStr = content.trim();
        if (jsonStr.startsWith("```")) {
          jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
        }
        const batchMatches = JSON.parse(jsonStr);
        if (Array.isArray(batchMatches)) {
          for (const match of batchMatches) {
            if (match.photoId && typeof match.score === "number" && match.score >= 0.5) {
              allMatches.push({ photoId: match.photoId, score: match.score });
            }
          }
        }
      } catch (parseError) {
        console.error("Failed to parse AI response:", content, parseError);
        // Continue with next batch
      }
    }

    // Sort by score descending
    allMatches.sort((a, b) => b.score - a.score);

    return new Response(
      JSON.stringify({ matches: allMatches }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("face-match error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
