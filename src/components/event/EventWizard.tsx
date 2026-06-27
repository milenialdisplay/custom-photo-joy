import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { NeonButton } from "@/components/site/NeonButton";
import {
  type Tier,
  type Package,
  TIER_LABELS,
  PACKAGE_LABELS,
  ADDON_PACK,
  basePrice,
  totalPrice,
  totalPrints,
  formatIDR,
} from "@/lib/event-pricing";
import { createPaidEvent, createCheckoutSession, genPin } from "@/lib/events.functions";

export function EventWizard() {
  const createPaid = useServerFn(createPaidEvent);
  const checkout = useServerFn(createCheckoutSession);

  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [tier, setTier] = useState<Tier>("t100");
  const [pkg, setPkg] = useState<Package | null>(null);
  const [addons, setAddons] = useState(0);
  const [pin, setPin] = useState(genPin());
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ slug: string; pin: string; name: string } | null>(null);

  const price = pkg ? totalPrice(tier, pkg, addons) : 0;
  const prints = pkg ? totalPrints(tier, pkg, addons) : 0;
  const canPay = Boolean(name.trim() && pkg && pin.match(/^\d{4}$/));

  async function handleProvider(provider: "midtrans" | "lemonsqueezy" | "instaqris") {
    if (!canPay) return;
    try {
      const res = await checkout({ data: { provider, amountIdr: price, label: name.trim() } });
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      } else {
        toast.info(res.message);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout failed");
    }
  }

  async function handleMarkPaid() {
    if (!canPay || !pkg) return;
    setBusy(true);
    try {
      const ev = await createPaid({
        data: {
          name: name.trim(),
          eventDate: date || undefined,
          tier,
          pkg,
          addonPacks: addons,
          priceIdr: price,
          printsIncluded: prints,
          accessPin: pin,
        },
      });
      setCreated({ slug: ev.slug, pin: ev.accessPin, name: ev.name });
      toast.success(`Event "${ev.name}" created`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <div className="border border-primary/30 bg-primary/5 p-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">// EVENT READY</div>
        <h2 className="mt-2 text-2xl font-bold uppercase tracking-tighter">{created.name}</h2>
        <p className="mt-2 font-mono text-xs text-foreground/70">
          Slug: <span className="text-primary">{created.slug}</span> · Access PIN:{" "}
          <span className="text-primary tracking-widest">{created.pin}</span>
        </p>
        <p className="mt-2 font-mono text-[10px] text-foreground/50">
          Save this PIN — your guests will need it to view the album.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to="/event/$slug/frame" params={{ slug: created.slug }}>
            <NeonButton size="md" glow>1 · Customize frame</NeonButton>
          </Link>
          <Link to="/event/$slug/dashboard" params={{ slug: created.slug }}>
            <NeonButton size="md" variant="ghost">Host dashboard</NeonButton>
          </Link>
          <Link to="/e/$slug" params={{ slug: created.slug }}>
            <NeonButton size="md" variant="ghost">Album</NeonButton>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Details */}
      <Section label="01 · Event details">
        <div className="grid gap-3 md:grid-cols-2">
          <LabeledInput label="Event name" value={name} onChange={setName} placeholder="Sarah's wedding" max={80} />
          <LabeledInput label="Event date" type="date" value={date} onChange={setDate} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(["t100", "t100plus"] as Tier[]).map((t) => (
            <Choice key={t} active={tier === t} onClick={() => setTier(t)}>
              {TIER_LABELS[t]}
            </Choice>
          ))}
        </div>
      </Section>

      {/* Package */}
      <Section label="02 · Package">
        <div className="grid grid-cols-2 gap-2">
          {(["A", "B"] as Package[]).map((p) => (
            <Choice key={p} active={pkg === p} onClick={() => setPkg(p)}>
              <div>
                <div>{p} · {PACKAGE_LABELS[p]}</div>
                <div className="mt-1 font-mono text-[10px] text-foreground/50 normal-case tracking-normal">
                  {formatIDR(basePrice(tier, p))}
                  {p === "B" && tier === "t100" && " · 100 prints"}
                  {p === "B" && tier === "t100plus" && " · pay per add-on"}
                </div>
              </div>
            </Choice>
          ))}
        </div>
        {pkg === "B" && (
          <div className="mt-4 border border-primary/15 p-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/60">
              Add-on print packs · {ADDON_PACK.prints} prints / {formatIDR(ADDON_PACK.price)}
            </div>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAddons((n) => Math.max(0, n - 1))}
                className="size-9 border border-primary/30 font-mono text-lg text-primary hover:bg-primary/10"
              >
                −
              </button>
              <div className="min-w-[3rem] text-center font-mono text-lg text-primary">{addons}</div>
              <button
                type="button"
                onClick={() => setAddons((n) => Math.min(50, n + 1))}
                className="size-9 border border-primary/30 font-mono text-lg text-primary hover:bg-primary/10"
              >
                +
              </button>
              <div className="ml-3 font-mono text-[10px] text-foreground/50">
                = {addons * ADDON_PACK.prints} extra prints
              </div>
            </div>
            <p className="mt-3 font-mono text-[10px] italic text-foreground/40">
              We also offer freeflow prints — please contact us.
            </p>
          </div>
        )}
      </Section>

      {/* PIN */}
      <Section label="03 · Album access PIN">
        <div className="flex items-center gap-3">
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="w-32 border border-primary/30 bg-background px-3 py-2 text-center font-mono text-2xl tracking-[0.5em] text-primary"
            maxLength={4}
          />
          <button
            type="button"
            onClick={() => setPin(genPin())}
            className="border border-primary/30 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-primary hover:bg-primary/10"
          >
            Regenerate
          </button>
        </div>
        <p className="mt-2 font-mono text-[10px] text-foreground/50">
          Guests enter this to view the album. Keep it short and memorable.
        </p>
      </Section>

      {/* Summary + Pay */}
      <Section label="04 · Summary & payment">
        <div className="border border-primary/20 bg-background/40 p-4">
          <Row k="Tier" v={TIER_LABELS[tier]} />
          <Row k="Package" v={pkg ? `${pkg} · ${PACKAGE_LABELS[pkg]}` : "—"} />
          <Row k="Add-on packs" v={pkg === "B" ? `${addons} (${addons * ADDON_PACK.prints} prints)` : "—"} />
          <Row k="Prints included" v={String(prints)} />
          <div className="mt-3 border-t border-primary/20 pt-3">
            <Row k="Total" v={<span className="text-xl text-primary">{formatIDR(price)}</span>} />
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <NeonButton size="md" variant="ghost" disabled={!canPay} onClick={() => handleProvider("midtrans")}>
            Pay · Midtrans
          </NeonButton>
          <NeonButton size="md" variant="ghost" disabled={!canPay} onClick={() => handleProvider("lemonsqueezy")}>
            Pay · LemonSqueezy
          </NeonButton>
          <NeonButton size="md" variant="ghost" disabled={!canPay} onClick={() => handleProvider("instaqris")}>
            Pay · InstaQRIS
          </NeonButton>
        </div>
        <div className="mt-3 border-t border-dashed border-primary/20 pt-3">
          <NeonButton size="md" glow disabled={!canPay || busy} onClick={handleMarkPaid}>
            {busy ? "Creating…" : "✔ Mark as paid (dev) & create event"}
          </NeonButton>
          <p className="mt-2 font-mono text-[10px] text-foreground/40">
            Payment providers stubbed — use Mark as paid until live keys land.
          </p>
        </div>
      </Section>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary/60">// {label}</div>
      {children}
    </div>
  );
}

function LabeledInput({
  label, value, onChange, type = "text", placeholder, max,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; max?: number }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/60">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={max}
        className="w-full border border-primary/20 bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-foreground/30"
      />
    </label>
  );
}

function Choice({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border p-3 text-left font-mono text-xs uppercase tracking-wider transition-colors ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-primary/20 text-foreground/70 hover:border-primary/50"
      }`}
    >
      {children}
    </button>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 font-mono text-xs">
      <span className="text-foreground/50">{k}</span>
      <span className="text-foreground">{v}</span>
    </div>
  );
}
