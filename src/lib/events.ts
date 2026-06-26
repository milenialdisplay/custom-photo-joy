// Browser helpers for events: list, upload a photo, fetch gallery.
import { getSupabase } from "@/integrations/supabase/client";

export interface EventRow {
  id: string;
  slug: string;
  name: string;
  bucket_name: string;
  created_at: string;
}

export interface EventPhotoRow {
  id: string;
  event_id: string;
  event_name: string;
  storage_path: string; // "{bucket}/{filename}"
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

export async function uploadEventPhoto(
  event: Pick<EventRow, "id" | "name" | "bucket_name">,
  file: File,
): Promise<{ path: string; publicUrl: string }> {
  const sb = getSupabase();
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const filename = `${ts}-${rand}-${safeName}`;

  const { error: upErr } = await sb.storage
    .from(event.bucket_name)
    .upload(filename, file, { cacheControl: "3600", upsert: false });
  if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

  const storagePath = `${event.bucket_name}/${filename}`;
  const { error: rowErr } = await sb.from("event_photos").insert({
    event_id: event.id,
    event_name: event.name,
    storage_path: storagePath,
  });
  if (rowErr) throw new Error(`Metadata insert failed: ${rowErr.message}`);

  const { data: pub } = sb.storage.from(event.bucket_name).getPublicUrl(filename);
  return { path: storagePath, publicUrl: pub.publicUrl };
}
