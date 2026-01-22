import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const dicomWebProxyTarget = env.VITE_DICOM_WEB_PROXY_TARGET || "http://localhost:8042";
  // Use separate proxy target env var (for Docker: http://backend:8000)
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || "http://localhost:8000";

  return {
    server: {
      host: "::",
      port: 5173,
      hmr: {
        overlay: false,
      },
      headers: {
        // Allow web workers to load from same origin
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "credentialless",
      },
      proxy: {
        "/dicom-web": {
          target: dicomWebProxyTarget,
          changeOrigin: true,
        },
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    assetsInclude: ["**/*.wasm"],
    worker: {
      format: "es",
    },
    build: {
      rollupOptions: {
        output: {
          format: "es",
        },
      },
    },
    optimizeDeps: {
      include: [
        "@cornerstonejs/core",
        "@cornerstonejs/tools",
        "@cornerstonejs/dicom-image-loader",
        "dicom-parser",
      ],
      esbuildOptions: {
        target: "esnext",
      },
    },
  };
});
