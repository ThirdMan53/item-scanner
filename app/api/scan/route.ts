import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { uploadImage, deleteBlob } from "@/lib/imageStore";

const SYSTEM_PROMPT =
  "Return ONLY a JSON object. No explanation, no markdown, no code fences, no text before or after the JSON. " +
  "You are an expert appraiser and researcher. When shown an image of an item, provide: " +
  "1) A detailed identification and description of the item, " +
  "2) Estimated market value range with reasoning, " +
  "3) Best places to buy or sell this specific item online and in person, " +
  "4) Interesting historical or background information about this type of item. " +
  "Respond with a single raw JSON object using exactly these keys: " +
  "description, valueRange, whereToBuySell, backgroundInfo. " +
  "Example format: {\"description\":\"...\",\"valueRange\":\"...\",\"whereToBuySell\":\"...\",\"backgroundInfo\":\"...\"}";

const VALID_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageMediaType = (typeof VALID_MEDIA_TYPES)[number];

export interface WebResult {
  title: string;
  price: string | null;
  link: string;
  source: string;
  thumbnail: string | null;
}

// ── JSON extraction ───────────────────────────────────────────────────────────
// Tries three strategies in order, most-to-least strict, so we gracefully
// handle whatever wrapping Claude decides to add despite the system prompt.

function extractJson(raw: string): Record<string, string> | null {
  const attempts: string[] = [];

  // 1. Strip common markdown code fences (```json ... ``` or ``` ... ```)
  const fenceStripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  attempts.push(fenceStripped);

  // 2. Grab everything from the first { to the last }
  const firstBrace = raw.indexOf("{");
  const lastBrace  = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    attempts.push(raw.slice(firstBrace, lastBrace + 1));
  }

  // 3. Regex: pull out the outermost {...} block (handles text before/after)
  const regexMatch = raw.match(/\{[\s\S]*\}/);
  if (regexMatch) attempts.push(regexMatch[0]);

  for (const candidate of attempts) {
    try {
      const obj = JSON.parse(candidate);
      if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj;
    } catch {
      // try next candidate
    }
  }

  return null;
}

// ── Claude ────────────────────────────────────────────────────────────────────

async function fetchClaudeAnalysis(
  client: Anthropic,
  image: string,
  mediaType: ImageMediaType
): Promise<Record<string, string>> {
  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: image },
          },
          { type: "text", text: "Please identify and appraise this item." },
        ],
      },
    ],
  });

  const rawText = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  console.log("[Claude raw response]", rawText);

  const parsed = extractJson(rawText);
  if (!parsed) {
    throw new Error(`Could not extract JSON from Claude response: ${rawText}`);
  }
  return parsed;
}

// ── SerpApi Google Lens ───────────────────────────────────────────────────────

async function fetchLensResults(
  imageUrl: string,
  apiKey: string
): Promise<WebResult[]> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_lens");
  url.searchParams.set("url", imageUrl);
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`SerpApi responded with ${res.status}`);

  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matches: any[] = data.visual_matches ?? [];

  return matches.slice(0, 5).map((m) => ({
    title: m.title ?? "Unknown",
    price: m.price?.value ?? null,
    link: m.link ?? "",
    source: m.source ?? "",
    thumbnail: m.thumbnail ?? null,
  }));
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY environment variable is not set." },
      { status: 500 }
    );
  }

  const serpApiKey = process.env.SERPAPI_KEY;          // optional
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN; // optional — enables SerpApi flow

  let body: { image?: string; mediaType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { image, mediaType } = body;

  if (!image || typeof image !== "string") {
    return NextResponse.json(
      { error: "Missing base64 image in request body." },
      { status: 400 }
    );
  }

  const resolvedMediaType: ImageMediaType = VALID_MEDIA_TYPES.includes(
    mediaType as ImageMediaType
  )
    ? (mediaType as ImageMediaType)
    : "image/jpeg";

  const client = new Anthropic({ apiKey: anthropicKey });

  // ── Parallel execution strategy ──────────────────────────────────────────
  //
  //  Timeline:
  //    t=0  ┌─ Claude analysis starts ──────────────────────────┐
  //         └─ Blob upload starts ──┐                            │
  //                                  └─ SerpApi starts ──────────┘
  //
  //  Claude and the blob upload run concurrently.
  //  SerpApi is chained onto the blob URL promise so it begins
  //  as soon as the upload resolves, without waiting for Claude.
  //  Total wall-clock time ≈ max(claude, blob_upload + serpapi).

  // Claude promise — always runs
  const claudePromise = fetchClaudeAnalysis(client, image, resolvedMediaType);

  // SerpApi promise — only runs when both keys are present; always resolves
  const webResultsPromise: Promise<WebResult[]> =
    serpApiKey && blobToken
      ? uploadImage(image, resolvedMediaType)
          .then((blobUrl) =>
            // SerpApi starts the moment we have the public URL
            fetchLensResults(blobUrl, serpApiKey).finally(() =>
              // Delete the temp blob whether SerpApi succeeded or failed
              deleteBlob(blobUrl).catch((e) =>
                console.warn("Blob cleanup failed (non-fatal):", e.message)
              )
            )
          )
          .catch((err) => {
            console.warn("SerpApi/Blob flow failed (non-fatal):", err.message);
            return [] as WebResult[];
          })
      : Promise.resolve([] as WebResult[]);

  try {
    const [claudeResult, webResults] = await Promise.all([
      claudePromise,
      webResultsPromise,
    ]);

    return NextResponse.json({ ...claudeResult, webResults });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Scan error:", msg);

    if (msg.startsWith("Could not extract JSON")) {
      return NextResponse.json(
        { error: "Claude returned an unexpected response format.", raw: msg },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: `API request failed: ${msg}` },
      { status: 502 }
    );
  }
}
