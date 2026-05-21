import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { execSync } from "child_process";

function buildToken(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return Date.now().toString(36);
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const cacheBust = buildToken();
  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    define: {
      __CACHE_BUST__: JSON.stringify(cacheBust),
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      {
        name: "stamp-public-assets",
        transformIndexHtml(html: string) {
          // Append ?v=<git-sha> to the favicon <link> so browsers always fetch
          // the latest icon after a deploy without breaking the public/ path.
          return html.replace(
            /(<link\s[^>]*rel="icon"[^>]*href="\/favicon\.png)(")/,
            `$1?v=${cacheBust}$2`,
          );
        },
      },
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
    },
  };
});
