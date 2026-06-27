// Server functions for events: create, mark paid, save frame, add prints.
// Service-role admin client loaded inside handlers (never at module scope).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "event"
  );
}

function genPin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Legacy: simple create (kept for back-compat with EventPanel)
export const createEvent = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ name: z.string().min(1).max(80) }).parse(input))
  .handler(async ({ data }) => {
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = getSupabaseAdmin();
    const base = slugify(data.name);
    let slug = base;
    for (let n = 2; n < 100; n++) {
      const { data: existing } = await admin.from("events").select("id").eq("slug", slug).maybeSingle();
      if (!existing) break;
      slug = `${base}-${n}`;
    }
    const bucketName = `${slug}.dpotopoto.com`;
    const { error: bucketErr } = await admin.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 25 * 1024 * 1024,
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

const CreatePaidInput = z.object({
  name: z.string().min(1).max(80),
  eventDate: z.string().optional(),
  tier: z.enum(["t100", "t100plus"]),
  pkg: z.enum(["A", "B"]),
  addonPacks: z.number().int().min(0).max(50).default(0),
  priceIdr: z.number().int().min(0),
  printsIncluded: z.number().int().min(0),
  accessPin: z.string().regex(/^\d{4}$/),
});

export const createPaidEvent = createServerFn({ method: "POST" })
  .inputValidator((input) => CreatePaidInput.parse(input))
  .handler(async ({ data }) => {
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = getSupabaseAdmin();

    const base = slugify(data.name);
    let slug = base;
    for (let n = 2; n < 100; n++) {
      const { data: existing } = await admin.from("events").select("id").eq("slug", slug).maybeSingle();
      if (!existing) break;
      slug = `${base}-${n}`;
    }
    const bucketName = `${slug}.dpotopoto.com`;

    const { error: bucketErr } = await admin.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 25 * 1024 * 1024,
    });
    if (bucketErr && !/already exists/i.test(bucketErr.message)) {
      throw new Error(`Bucket create failed: ${bucketErr.message}`);
    }

    const { data: row, error } = await admin
      .from("events")
      .insert({
        slug,
        name: data.name,
        bucket_name: bucketName,
        event_date: data.eventDate || null,
        guest_tier: data.tier,
        package: data.pkg,
        price_idr: data.priceIdr,
        print_credits: data.printsIncluded,
        print_credits_remaining: data.printsIncluded,
        access_pin: data.accessPin,
        paid_at: new Date().toISOString(),
      })
      .select("id, slug, name, bucket_name, access_pin")
      .single();
    if (error) throw new Error(`Event insert failed: ${error.message}`);

    return {
      id: row.id as string,
      slug: row.slug as string,
      name: row.name as string,
      bucketName: row.bucket_name as string,
      accessPin: row.access_pin as string,
    };
  });

export const addPrintCredits = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ eventId: z.string().uuid(), packs: z.number().int().min(1).max(50) }).parse(input))
  .handler(async ({ data }) => {
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = getSupabaseAdmin();
    const added = data.packs * 20;
    const { data: ev, error: getErr } = await admin
      .from("events")
      .select("print_credits, print_credits_remaining")
      .eq("id", data.eventId)
      .single();
    if (getErr || !ev) throw new Error("Event not found");
    const { error } = await admin
      .from("events")
      .update({
        print_credits: (ev.print_credits ?? 0) + added,
        print_credits_remaining: (ev.print_credits_remaining ?? 0) + added,
      })
      .eq("id", data.eventId);
    if (error) throw new Error(error.message);
    return { added };
  });

export const saveEventFrame = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        eventId: z.string().uuid(),
        frameUrl: z.string().url(),
        slot: z.object({
          rect: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
          ratio: z.enum(["1:1", "2:3", "3:2"]),
        }),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from("events")
      .update({ frame_url: data.frameUrl, frame_slot: data.slot })
      .eq("id", data.eventId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Payment provider stub — returns a fake checkout URL. Replace later with real SDKs.
export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        provider: z.enum(["midtrans", "lemonsqueezy", "instaqris"]),
        amountIdr: z.number().int().min(1),
        label: z.string().max(120),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    // TODO: wire real provider SDKs. For now, return a dev placeholder.
    return {
      provider: data.provider,
      checkoutUrl: null as string | null,
      message: `${data.provider} checkout not yet wired — use "Mark as paid (dev)" for now.`,
    };
  });

export { genPin };
