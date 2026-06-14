import { GoogleGenAI } from "@google/genai";
import { writeFileSync } from "node:fs";

export const IMAGE_STYLE =
  "Warm friendly flat-style vector illustration, leaf-green and warm cream color palette, soft rounded organic shapes, diverse and joyful Muslim children some wearing hijab or kufi, welcoming and wholesome, clean simple uncluttered background, gentle soft lighting, consistent storybook look. Absolutely no text, no words, no letters, no captions anywhere in the image.";

const [subject, aspect = "1:1", output = "public/brand/generated.png"] =
  process.argv.slice(2);

if (!subject) {
  console.error(
    'Usage: GEMINI_API_KEY=... node scripts/generate-image.mjs "<subject>" [aspect] [output]',
  );
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const res = await ai.models.generateContent({
  model: "gemini-3-pro-image-preview",
  contents: `${subject}. ${IMAGE_STYLE}`,
  config: { responseModalities: ["Image"], imageConfig: { aspectRatio: aspect } },
});

const part = (res.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData);
if (!part) {
  console.error("No image returned");
  process.exit(2);
}

writeFileSync(output, Buffer.from(part.inlineData.data, "base64"));
console.log("Saved", output);
