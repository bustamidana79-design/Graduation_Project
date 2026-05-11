import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";
import { groq } from "@/lib/groq";

function parseSuggestion(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}") + 1;
  if (start === -1 || end <= 0) throw new Error("AI response was not JSON.");
  const parsed = JSON.parse(raw.slice(start, end));
  return {
    name: String(parsed.name || "").trim(),
    description: String(parsed.description || "").trim(),
  };
}

export async function POST(request: NextRequest) {
  try {
    await requireAuthProfile(request);
    const formData = await request.formData();
    const file = formData.get("image");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Image is required." }, { status: 400 });
    }

    const mimeType = file.type || "image/jpeg";
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");

    const response = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      max_tokens: 500,
      temperature: 0.35,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "اكتب اسم منتج عربي قصير ووصفاً احترافياً مناسباً للبيع بناءً على الصورة. أرجع JSON فقط بهذا الشكل: {\"name\":\"...\",\"description\":\"...\"}",
            },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
          ],
        },
      ],
    });

    const suggestion = parseSuggestion(response.choices[0].message.content || "");
    return NextResponse.json({ suggestion });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to suggest product details.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "Login is required." : message }, { status });
  }
}
