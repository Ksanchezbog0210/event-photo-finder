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
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all face descriptors for this event
    const { data: descriptors, error: descError } = await supabase
      .from("face_descriptors")
      .select("id, photo_id, face_index, descriptor")
      .eq("event_id", eventId)
      .order("photo_id")
      .order("face_index");

    if (descError || !descriptors || descriptors.length === 0) {
      // Fallback: if no descriptors exist, tell user photos aren't indexed yet
      return new Response(
        JSON.stringify({ 
          error: "Las fotos de este evento aún no han sido procesadas. El fotógrafo debe indexar las fotos primero.",
          matches: [],
          notIndexed: true
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build a text catalog of all faces
    const faceCatalog = descriptors.map((d, i) => 
      `Face #${i + 1} (photoId: ${d.photo_id}, faceIndex: ${d.face_index}): ${d.descriptor}`
    ).join("\n");

    // Single AI call: send selfie + text catalog
    const messages = [
      {
        role: "system",
        content: `You are a face matching assistant. You will receive a selfie photo and a TEXT CATALOG of face descriptions from event photos.

Your task: Compare the person in the selfie against ALL face descriptions in the catalog and find matches.

MATCHING RULES:
- Match based on: age range, gender, skin tone, hair style/color, facial structure, glasses, facial hair
- Be generous — if descriptions reasonably match the selfie person, include them
- A person may appear in multiple photos
- Multiple faces in one photo may match (different angles)

SCORING:
- 0.9+: Very confident — most features match closely
- 0.7-0.9: Likely match — key features align
- 0.5-0.7: Possible match — some features align
- Only include matches with score >= 0.5

OUTPUT FORMAT: Return ONLY a JSON array of objects:
[{"photoId": "uuid-string", "score": 0.85}, ...]

Group by photoId — if multiple faces in same photo match, use the highest score.
Return ONLY the JSON array, no other text. If no matches, return [].

FACE CATALOG:
${faceCatalog}`,
      },
      {
        role: "user",
        content: [
          { type: "text", text: "This is my selfie. Find me in the face catalog above:" },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${selfieBase64}` },
          },
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
          max_tokens: 1000,
        }),
      }
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);

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
      return new Response(
        JSON.stringify({ error: "Error del servicio de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "[]";

    let allMatches: { photoId: string; score: number }[] = [];

    try {
      let jsonStr = content.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      }
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        // Deduplicate by photoId, keeping highest score
        const bestScores = new Map<string, number>();
        for (const match of parsed) {
          if (match.photoId && typeof match.score === "number" && match.score >= 0.5) {
            const existing = bestScores.get(match.photoId) ?? 0;
            if (match.score > existing) {
              bestScores.set(match.photoId, match.score);
            }
          }
        }
        allMatches = Array.from(bestScores.entries())
          .map(([photoId, score]) => ({ photoId, score }))
          .sort((a, b) => b.score - a.score);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content, parseError);
    }

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
