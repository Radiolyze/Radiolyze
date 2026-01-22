import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const dicomWebProxyTarget = env.VITE_DICOM_WEB_PROXY_TARGET || "http://localhost:8042";

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      proxy: {
        "/dicom-web": {
          target: dicomWebProxyTarget,
          changeOrigin: true,
        },
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
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
      exclude: [
        "@cornerstonejs/dicom-image-loader",
        "@cornerstonejs/codec-libjpeg-turbo-8bit",
        "@cornerstonejs/codec-charls",
        "@cornerstonejs/codec-openjpeg",
        "@cornerstonejs/codec-openjph",
      ],
    },
  };
});
