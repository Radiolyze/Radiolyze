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
        // Required for SharedArrayBuffer support (used by Cornerstone web workers)
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
        // Allow web workers from same origin
        "Content-Security-Policy": "worker-src 'self' blob:;",
      },
      proxy: {
        "/dicom-web": {
          target: dicomWebProxyTarget,
          changeOrigin: true,
          // Add auth headers for Orthanc DICOMweb requests and CORP headers for COEP compatibility
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              // Deliberately NOT read from VITE_-prefixed vars: Vite exposes any
              // VITE_* env var to client bundles via import.meta.env, which would
              // ship the DICOMweb credentials to every browser. These vars are
              // Node-only and only ever used here, server-side, to inject the
              // Basic Auth header on the dev-server proxy.
              const username = env.DICOM_WEB_PROXY_USERNAME || "orthanc";
              const password = env.DICOM_WEB_PROXY_PASSWORD || "orthanc";
              const auth = Buffer.from(`${username}:${password}`).toString("base64");
              proxyReq.setHeader("Authorization", `Basic ${auth}`);
            });
            // Add CORP header to response for COEP compatibility
            proxy.on("proxyRes", (proxyRes) => {
              proxyRes.headers["cross-origin-resource-policy"] = "cross-origin";
            });
          },
        },
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
          ws: true,
          // Add CORP header to response for COEP compatibility
          configure: (proxy) => {
            proxy.on("proxyRes", (proxyRes) => {
              proxyRes.headers["cross-origin-resource-policy"] = "cross-origin";
            });
          },
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
          manualChunks: {
            cornerstone: [
              "@cornerstonejs/core",
              "@cornerstonejs/tools",
              "@cornerstonejs/dicom-image-loader",
              "dicom-parser",
            ],
            vtk: ["@kitware/vtk.js"],
            recharts: ["recharts"],
          },
        },
      },
    },
    optimizeDeps: {
      include: [
        "@cornerstonejs/core",
        "@cornerstonejs/tools",
        "@cornerstonejs/dicom-image-loader",
        "dicom-parser",
        // vtk.js and its dependencies need CJS transformation
        "@kitware/vtk.js",
        "globalthis",
        // Codec packages need CJS transformation for their JS wrappers
        "@cornerstonejs/codec-charls",
        "@cornerstonejs/codec-libjpeg-turbo-8bit",
        "@cornerstonejs/codec-openjpeg",
        "@cornerstonejs/codec-openjph",
      ],
      esbuildOptions: {
        target: "esnext",
      },
    },
  };
});
