import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
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
}));
