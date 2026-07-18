import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cpSync, readFile } from "node:fs";
import { extname, join, normalize } from "node:path";
import { documentationRequestNeedsVite } from "./src/platform/documentationRequest";

const tauriHost = process.env.TAURI_DEV_HOST;
const documentationRoot = join(import.meta.dirname, "documentation");

const documentationPlugin = {
  name: "jumpchain-documentation",
  configureServer(server: {
    middlewares: {
      use: (
        path: string,
        handler: (
          request: {
            url?: string;
            headers?: Record<string, string | string[] | undefined>;
          },
          response: {
            statusCode: number;
            setHeader: (name: string, value: string) => void;
            end: (body?: Buffer | string) => void;
          },
          next: () => void,
        ) => void,
      ) => void;
    };
  }) {
    server.middlewares.use("/documentation", (request, response, next) => {
      const url = new URL(request.url ?? "/", "http://localhost");
      const fetchDestination = request.headers?.["sec-fetch-dest"];
      if (
        documentationRequestNeedsVite(
          request.url ?? "/",
          typeof fetchDestination === "string" ? fetchDestination : undefined,
        )
      ) {
        next();
        return;
      }
      const requested = decodeURIComponent(url.pathname);
      const relative = normalize(requested).replace(/^[/\\]+/, "");
      if (!relative || relative.startsWith("..")) {
        next();
        return;
      }
      readFile(join(documentationRoot, relative), (error, content) => {
        if (error) {
          next();
          return;
        }
        const types: Record<string, string> = {
          ".html": "text/html; charset=utf-8",
          ".css": "text/css; charset=utf-8",
          ".js": "text/javascript; charset=utf-8",
          ".svg": "image/svg+xml",
          ".png": "image/png",
        };
        response.statusCode = 200;
        response.setHeader(
          "Content-Type",
          types[extname(relative)] ?? "application/octet-stream",
        );
        response.end(content);
      });
    });
  },
  closeBundle() {
    cpSync(
      documentationRoot,
      join(import.meta.dirname, "dist", "documentation"),
      {
        recursive: true,
      },
    );
  },
};

export default defineConfig({
  plugins: [react(), documentationPlugin],
  clearScreen: false,
  server: {
    host: tauriHost ?? "127.0.0.1",
    port: 1420,
    strictPort: true,
    hmr: tauriHost
      ? {
          protocol: "ws",
          host: tauriHost,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**", "**/crates/**"],
    },
  },
});
