// Browser helpers for events: list, upload, gallery, PIN, prints, booth handoff.
import { getSupabase } from "@/integrations/supabase/client";

export interface EventRow {
  id: string;
  slug: string;
  name: string;
  bucket_name: string;
  created_at: string;
  event_date?: string | null;
  guest_tier?: "t100" | "t100plus" | null;
  package?: "A" | "B" | null;
  price_idr?: number | null;
  print_credits?: number | null;
  print_credits_remaining?: number | null;
  paid_at?: string | null;
  frame_url?: string | null;
  frame_slot?: { rect: { x: number; y: number; w: number; h: number }; ratio: "1:1" | "2:3" | "3:2" } | null;
  access_pin?: string | null;
}

export interface EventPhotoRow {
  id: string;
  event_id: string;
  event_name: string;
  storage_path: string;
  created_at: string;
}

export async function listEvents(): Promise<EventRow[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("events")
    .select("id, slug, name, bucket_name, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as EventRow[];
}

export async function getEventBySlug(slug: string): Promise<EventRow | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("events")
    .select(
      "id, slug, name, bucket_name, created_at, event_date, guest_tier, package, price_idr, print_credits, print_credits_remaining, paid_at, frame_url, frame_slot, access_pin",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as EventRow | null) ?? null;
}

export async function listEventPhotos(eventId: string): Promise<EventPhotoRow[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("event_photos")
    .select("id, event_id, event_name, storage_path, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as EventPhotoRow[];
}

export function publicUrlForPath(storagePath: string): string {
  const sb = getSupabase();
  const slashIdx = storagePath.indexOf("/");
  if (slashIdx < 0) return "";
  const bucket = storagePath.slice(0, slashIdx);
  const file = storagePath.slice(slashIdx + 1);
  return sb.storage.from(bucket).getPublicUrl(file).data.publicUrl;
}

export async function uploadEventPhoto(
  event: Pick<EventRow, "id" | "name" | "bucket_name">,
  file: File | Blob,
  filenameOverride?: string,
): Promise<{ path: string; publicUrl: string }> {
  const sb = getSupabase();
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const origName = filenameOverride ?? (file instanceof File ? file.name : `photo-${ts}.jpg`);
  const safeName = origName.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const filename = `${ts}-${rand}-${safeName}`;
  const { error: upErr } = await sb.storage
    .from(event.bucket_name)
    .upload(filename, file, { cacheControl: "3600", upsert: false, contentType: (file as File).type || "image/jpeg" });
  if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
  const storagePath = `${event.bucket_name}/${filename}`;
  const { error: rowErr } = await sb
    .from("event_photos")
    .insert({ event_id: event.id, event_name: event.name, storage_path: storagePath });
  if (rowErr) throw new Error(`Metadata insert failed: ${rowErr.message}`);
  const { data: pub } = sb.storage.from(event.bucket_name).getPublicUrl(filename);
  return { path: storagePath, publicUrl: pub.publicUrl };
}

/** Upload a frame image to `_frames/active.<ext>`; returns public URL. */
export async function uploadFrameImage(bucket: string, file: File): Promise<string> {
  const sb = getSupabase();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `_frames/active-${Date.now()}.${ext}`;
  const { error } = await sb.storage
    .from(bucket)
    .upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type || "image/jpeg" });
  if (error) throw new Error(error.message);
  return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function consumePrintCredit(eventId: string): Promise<boolean> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("consume_print_credit", { _event_id: eventId });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

/** POST a composited JPEG blob to the local printer agent. */
export async function submitToBooth(agentUrl: string, blob: Blob, copies = 1): Promise<void> {
  const form = new FormData();
  form.append("file", blob, `event-${Date.now()}.jpg`);
  form.append("copies", String(copies));
  form.append("size", "A5");
  form.append("paper_preset", "default");
  const res = await fetch(`${agentUrl.replace(/\/$/, "")}/api/print`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Booth print failed (${res.status})`);
}

// ── PIN cache ────────────────────────────────────────────────────────────────
const pinKey = (slug: string) => `event-pin:${slug}`;
export function getCachedPin(slug: string): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(pinKey(slug));
}
export function cachePin(slug: string, pin: string) {
  if (typeof localStorage !== "undefined") localStorage.setItem(pinKey(slug), pin);
}

// ── per-guest print used flag ────────────────────────────────────────────────
const printedKey = (slug: string) => `event-printed:${slug}`;
export function hasGuestPrinted(slug: string): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(printedKey(slug)) === "1";
}
export function markGuestPrinted(slug: string) {
  if (typeof localStorage !== "undefined") localStorage.setItem(printedKey(slug), "1");
}

// ── per-guest upload counter (max 35) ────────────────────────────────────────
const uploadKey = (slug: string) => `event-uploads:${slug}`;
export function getGuestUploadCount(slug: string): number {
  if (typeof localStorage === "undefined") return 0;
  return Number(localStorage.getItem(uploadKey(slug)) || "0");
}
export function incGuestUploadCount(slug: string): number {
  const next = getGuestUploadCount(slug) + 1;
  if (typeof localStorage !== "undefined") localStorage.setItem(uploadKey(slug), String(next));
  return next;
}
