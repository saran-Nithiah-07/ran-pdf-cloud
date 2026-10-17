import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  },
  // @docx-editor.dev/core loads its text-shaping engine (HarfBuzz via WASM)
  // with a top-level `await`, which Vite's default dependency pre-bundling
  // target (es2020) rejects outright. Both `build.target` and the
  // `optimizeDeps` esbuild target need bumping to `esnext` — the former
  // for the production build, the latter for dev-server pre-bundling,
  // which is where this error actually surfaces.
  build: {
    target: "esnext"
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "esnext"
    },
    // @docx-editor.dev/core loads its WASM text-shaping engine and font
    // assets via a runtime-computed dynamic import() that Vite's
    // dependency scanner can't statically resolve — it shows up as
    // repeated "file does not exist at .../deps/undefined" warnings and
    // can eventually break the dev server. Excluding these from
    // pre-bundling makes Vite serve them as native ESM instead, which
    // resolves the dynamic import at runtime in the browser rather than
    // trying to analyze it ahead of time.
    exclude: ["@docx-editor.dev/core", "@docx-editor.dev/react", "@docx-editor.dev/fonts"]
  }
});
