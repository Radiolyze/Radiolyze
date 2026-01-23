import { defineConfig, loadEnv, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Plugin to handle Cornerstone worker files that Vite can't serve
// When maxWebWorkers: 0 is set, we don't need actual workers, so serve a no-op stub
function cornerstoneWorkerStub(): Plugin {
  return {
    name: "cornerstone-worker-stub",
    configureServer(server) {
      // Add middleware BEFORE Vite's default middleware to intercept worker requests
      server.middlewares.use((req, res, next) => {
        const url = req.url || "";
        // Intercept requests for Cornerstone worker files that would otherwise 404
        if (url.includes("decodeImageFrameWorker") && url.includes("worker_file")) {
          // Serve a minimal no-op worker module
          res.setHeader("Content-Type", "application/javascript; charset=utf-8");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.statusCode = 200;
          // Empty worker that just exports nothing - Cornerstone will fall back to main thread
          res.end(`
            // Stub worker for Cornerstone - actual decoding happens on main thread (maxWebWorkers: 0)
            self.onmessage = function(e) {
              // No-op: decoding disabled in workers
              self.postMessage({ error: 'Workers disabled' });
            };
          `);
          return;
        }
        next();
      });
    },
  };
}

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
            proxy.on('proxyReq', (proxyReq) => {
              const username = env.VITE_DICOM_WEB_USERNAME || 'orthanc';
              const password = env.VITE_DICOM_WEB_PASSWORD || 'orthanc';
              const auth = Buffer.from(`${username}:${password}`).toString('base64');
              proxyReq.setHeader('Authorization', `Basic ${auth}`);
            });
            // Add CORP header to response for COEP compatibility
            proxy.on('proxyRes', (proxyRes) => {
              proxyRes.headers['cross-origin-resource-policy'] = 'cross-origin';
            });
          },
        },
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
          ws: true,
          // Add CORP header to response for COEP compatibility
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              proxyRes.headers['cross-origin-resource-policy'] = 'cross-origin';
            });
          },
        },
      },
    },
    plugins: [
      react(),
      cornerstoneWorkerStub(),
      mode === "development" && componentTagger(),
    ].filter(Boolean),
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
