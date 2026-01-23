import { defineConfig, loadEnv, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Plugin to fix MIME type for worker files served from node_modules/.vite/deps
function workerMimeTypeFix(): Plugin {
  return {
    name: "worker-mime-type-fix",
    configureServer(server) {
      // Add middleware early to intercept worker file requests
      server.middlewares.use((req, res, next) => {
        const url = req.url || "";
        // Detect worker files from Vite deps cache
        if (url.includes(".vite/deps") && url.includes("Worker")) {
          // Intercept the response to ensure Content-Type is set
          const originalEnd = res.end.bind(res);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          res.end = function (...args: any[]) {
            if (!res.headersSent && !res.getHeader("content-type")) {
              res.setHeader("Content-Type", "application/javascript; charset=utf-8");
            }
            return originalEnd(...args);
          };
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
      workerMimeTypeFix(),
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
