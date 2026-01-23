#!/usr/bin/env node
/**
 * Bundle the Cornerstone DICOM Image Loader worker with all dependencies.
 * This is needed because Vite doesn't properly handle worker files from node_modules.
 */

import * as esbuild from 'esbuild';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, copyFileSync, readdirSync, readFileSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Directly construct the path to the worker file in node_modules
const workerEntryPoint = join(projectRoot, 'node_modules', '@cornerstonejs', 'dicom-image-loader', 'dist', 'esm', 'decodeImageFrameWorker.js');

// Output directory
const outputDir = join(projectRoot, 'public', 'workers');
const outputFile = join(outputDir, 'cornerstone-decode-worker.bundle.js');

// Create output directory if it doesn't exist
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
  console.log(`Created directory: ${outputDir}`);
}

console.log('Bundling Cornerstone worker...');
console.log(`  Entry: ${workerEntryPoint}`);
console.log(`  Output: ${outputFile}`);

// Plugin to handle Node.js built-ins that are conditionally imported by codec packages
// These are only used in Node.js environment, not in web workers
const nodeBuiltinsPlugin = {
  name: 'node-builtins',
  setup(build) {
    // Mark Node.js built-ins as external (they won't be used in browser)
    build.onResolve({ filter: /^(fs|path|crypto|os|stream|util|buffer|http|https|url|zlib)$/ }, args => ({
      path: args.path,
      namespace: 'node-builtin',
    }));
    
    // Return empty module for Node.js built-ins
    build.onLoad({ filter: /.*/, namespace: 'node-builtin' }, () => ({
      contents: 'export default {}; export const existsSync = () => false; export const readFileSync = () => null;',
      loader: 'js',
    }));
  },
};

// Banner to fix WASM file loading paths in web worker context
// The Emscripten-generated code uses scriptDirectory which may be empty or incorrect,
// so WASM files get fetched from wrong URL. This intercepts fetch and fixes paths.
const wasmPathBanner = `
// Fix WASM file loading in web worker context
var __wasmBasePath__ = '/workers/';
var __wasmFiles__ = ['libjpegturbowasm_decode.wasm', 'libjpegturbowasm.wasm', 'charlswasm_decode.wasm', 'charlswasm.wasm', 'openjpegwasm_decode.wasm', 'openjpegwasm.wasm', 'openjphjs.wasm'];
var __originalFetch__ = self.fetch;
self.fetch = function(input, init) {
  if (typeof input === 'string') {
    // Check for bare .wasm filenames
    if (input.match(/^[a-zA-Z0-9_-]+\\.wasm$/)) {
      console.log('[WASM loader] Fixing bare path:', input, '->', __wasmBasePath__ + input);
      input = __wasmBasePath__ + input;
    }
    // Check for incorrect root path (e.g., http://localhost:5173/filename.wasm)
    else {
      for (var i = 0; i < __wasmFiles__.length; i++) {
        var wasmFile = __wasmFiles__[i];
        // Match URLs ending with /filename.wasm but not /workers/filename.wasm
        if (input.endsWith('/' + wasmFile) && !input.includes('/workers/')) {
          var fixedUrl = input.replace('/' + wasmFile, '/workers/' + wasmFile);
          console.log('[WASM loader] Fixing URL:', input, '->', fixedUrl);
          input = fixedUrl;
          break;
        }
      }
    }
  }
  return __originalFetch__.call(this, input, init);
};
`;

try {
  const result = await esbuild.build({
    entryPoints: [workerEntryPoint],
    bundle: true,
    outfile: outputFile,
    format: 'esm',
    platform: 'browser',
    target: ['es2020'],
    // Minify in production
    minify: process.env.NODE_ENV === 'production',
    sourcemap: process.env.NODE_ENV !== 'production',
    // Handle WASM files from codec packages
    loader: {
      '.wasm': 'file',
    },
    // Use plugin to handle Node.js built-ins
    plugins: [nodeBuiltinsPlugin],
    // Log level
    logLevel: 'info',
    // Define for proper environment detection
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    },
    // Add banner to fix WASM paths
    banner: {
      js: wasmPathBanner,
    },
  });

  if (result.errors.length > 0) {
    console.error('Build errors:', result.errors);
    process.exit(1);
  }

  console.log('Worker bundle created successfully!');
  
  if (result.warnings.length > 0) {
    console.log('Warnings:', result.warnings);
  }

  // Post-process: Fix WASM paths directly in the bundle
  // The Emscripten code sets wasmBinaryFile = "filename.wasm" which then gets
  // resolved relative to the page URL instead of the worker URL.
  // We fix this by replacing the bare filenames with absolute paths.
  console.log('\nFixing WASM paths in bundle...');
  let bundleContent = readFileSync(outputFile, 'utf-8');
  
  const wasmFiles = [
    'libjpegturbowasm_decode.wasm',
    'libjpegturbowasm.wasm',
    'charlswasm_decode.wasm',
    'charlswasm.wasm',
    'openjpegwasm_decode.wasm',
    'openjpegwasm.wasm',
    'openjphjs.wasm',
  ];
  
  let replacements = 0;
  for (const wasmFile of wasmFiles) {
    // Replace: wasmBinaryFile = "filename.wasm"
    // With:    wasmBinaryFile = "/workers/filename.wasm"
    const pattern = new RegExp(`wasmBinaryFile = "${wasmFile}"`, 'g');
    const replacement = `wasmBinaryFile = "/workers/${wasmFile}"`;
    const matches = bundleContent.match(pattern);
    if (matches) {
      bundleContent = bundleContent.replace(pattern, replacement);
      replacements += matches.length;
      console.log(`  Fixed: ${wasmFile} (${matches.length} occurrences)`);
    }
  }
  
  if (replacements > 0) {
    writeFileSync(outputFile, bundleContent);
    console.log(`Total WASM path fixes: ${replacements}`);
  } else {
    console.log('  No WASM paths found to fix (may already be correct)');
  }

  // Copy WASM files from codec packages
  console.log('\nCopying WASM codec files...');
  const codecPackages = [
    '@cornerstonejs/codec-charls',
    '@cornerstonejs/codec-libjpeg-turbo-8bit',
    '@cornerstonejs/codec-openjpeg',
    '@cornerstonejs/codec-openjph',
  ];

  for (const pkg of codecPackages) {
    const pkgDistDir = join(projectRoot, 'node_modules', pkg, 'dist');
    if (existsSync(pkgDistDir)) {
      const files = readdirSync(pkgDistDir);
      for (const file of files) {
        if (file.endsWith('.wasm')) {
          const srcPath = join(pkgDistDir, file);
          const destPath = join(outputDir, file);
          copyFileSync(srcPath, destPath);
          console.log(`  Copied: ${file}`);
        }
      }
    }
  }

  console.log('\nAll codec files copied successfully!');
} catch (error) {
  console.error('Failed to bundle worker:', error);
  process.exit(1);
}
