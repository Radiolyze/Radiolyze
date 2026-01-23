#!/usr/bin/env node
/**
 * Bundle the Cornerstone DICOM Image Loader worker with all dependencies.
 * This is needed because Vite doesn't properly handle worker files from node_modules.
 */

import * as esbuild from 'esbuild';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, copyFileSync, readdirSync } from 'fs';

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
  });

  if (result.errors.length > 0) {
    console.error('Build errors:', result.errors);
    process.exit(1);
  }

  console.log('Worker bundle created successfully!');
  
  if (result.warnings.length > 0) {
    console.log('Warnings:', result.warnings);
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
