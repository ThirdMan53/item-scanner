import { put, del } from "@vercel/blob";
import { randomUUID } from "crypto";

// Uploads a base64-encoded image to Vercel Blob and returns its public URL.
// Vercel Blob works in both local development and on Vercel's serverless
// runtime — every invocation gets the same shared storage, so the URL is
// reachable by SerpApi regardless of which instance handles the request.
//
// Requires BLOB_READ_WRITE_TOKEN in your environment (.env.local in dev,
// or auto-injected by Vercel when you add Blob storage to the project).
//
// Throws if the token is missing or the upload fails — callers should catch
// and fall back to empty webResults rather than surfacing a hard error.

export async function uploadImage(data: string, mediaType: string): Promise<string> {
  const ext = mediaType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const filename = `temp-scans/${randomUUID()}.${ext}`;
  const bytes = Buffer.from(data, "base64");

  const blob = await put(filename, bytes, {
    access: "public",
    contentType: mediaType,
    addRandomSuffix: false, // UUID filename is already unique
  });

  return blob.url;
}

// Deletes a previously uploaded blob by its URL.
// Errors are intentionally swallowed by callers — a leaked temp blob
// is harmless and shouldn't affect the scan result.
export async function deleteBlob(url: string): Promise<void> {
  await del(url);
}
