// ============= Full file contents =============
// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Inject BYO Supabase public credentials at build time so the browser bundle
// can construct a Supabase client without exposing secrets through VITE_ env.
// Only URL + publishable (anon) key are inlined — both are safe in browser code.
// The service-role key stays server-only via process.env in server functions.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    define: {
      __BYO_SUPABASE_URL__: JSON.stringify(process.env.BYO_SUPABASE_URL ?? ""),
      __BYO_SUPABASE_PUBLISHABLE_KEY__: JSON.stringify(
        process.env.BYO_SUPABASE_PUBLISHABLE_KEY ?? "",
      ),
    },
  },
});
