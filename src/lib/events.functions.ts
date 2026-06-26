// Server function: create an event + its dedicated Storage bucket.
// Service-role key only available server-side; bucket creation needs it.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "event";
}

export const createEvent = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ name: z.string().min(1).max(80) }).parse(input))
  .handler(async ({ data }) => {
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = getSupabaseAdmin();

    // Find a free slug
    const base = slugify(data.name);
    let slug = base;
    for (let n = 2; n < 100; n++) {
      const { data: existing } = await admin
        .from("events")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!existing) break;
      slug = `${base}-${n}`;
    }
    const bucketName = `${slug}.dpotopoto.com`;

    // Create the storage bucket (public-read so gallery URLs work without signing)
    const { error: bucketErr } = await admin.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 25 * 1024 * 1024, // 25 MB per photo
    });
    if (bucketErr && !/already exists/i.test(bucketErr.message)) {
      throw new Error(`Bucket create failed: ${bucketErr.message}`);
    }

    const { data: row, error } = await admin
      .from("events")
      .insert({ slug, name: data.name, bucket_name: bucketName })
      .select("id, slug, name, bucket_name")
      .single();
    if (error) throw new Error(`Event insert failed: ${error.message}`);

    return {
      id: row.id as string,
      slug: row.slug as string,
      name: row.name as string,
      bucketName: row.bucket_name as string,
    };
  });
