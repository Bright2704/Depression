#!/usr/bin/env node
/**
 * สแกนโฟลเดอร์ models/ — รองรับทั้ง repo (frontend/scripts) และ Docker แบบแบน (/app)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveRepoRoot(scriptDir) {
  const oneUp = path.resolve(scriptDir, '..');
  const twoUp = path.resolve(scriptDir, '..', '..');
  const m1 = path.join(oneUp, 'models');
  const m2 = path.join(twoUp, 'models');
  if (fs.existsSync(m1)) return oneUp;
  if (fs.existsSync(m2)) return twoUp;
  if (path.basename(oneUp) === 'frontend') return twoUp;
  return oneUp;
}

const ROOT = resolveRepoRoot(__dirname);
const MODELS_DIR = path.join(ROOT, 'models');
const OUT = path.join(MODELS_DIR, 'inventory.json');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function listFilesRecursive(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...listFilesRecursive(full, base));
    } else {
      out.push(path.relative(base, full).replace(/\\/g, '/'));
    }
  }
  return out;
}

function sniffOnnxMeta(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    if (buf.length < 16) return { onnx: true, note: 'file_too_small' };
    const magic = buf.slice(0, 6).toString('utf8');
    if (magic !== 'ONNX\x20') return { onnx: true, note: 'unexpected_magic' };
    return {
      onnx: true,
      byteLength: buf.length,
      note: 'use_manifest_for_input_shape',
    };
  } catch (err) {
    return { onnx: false, error: String(err) };
  }
}

function main() {
  ensureDir(MODELS_DIR);

  const relativePaths = listFilesRecursive(MODELS_DIR).filter(
    (p) => p !== 'inventory.json'
  );

  const files = relativePaths.map((rel) => {
    const abs = path.join(MODELS_DIR, rel);
    const stat = fs.statSync(abs);
    const ext = path.extname(rel).toLowerCase();
    const entry = {
      relativePath: rel,
      extension: ext || '(none)',
      sizeBytes: stat.size,
      mtimeMs: stat.mtimeMs,
    };

    if (ext === '.onnx') {
      entry.onnx = sniffOnnxMeta(abs);
    }

    return entry;
  });

  let manifestPath = null;
  for (const f of files) {
    if (f.relativePath.endsWith('manifest.json') || f.relativePath.endsWith('facepsy.manifest.json')) {
      manifestPath = f.relativePath;
      break;
    }
  }

  const inventory = {
    generatedAt: new Date().toISOString(),
    modelsRoot: 'models/',
    summary: {
      fileCount: files.length,
      extensions: [...new Set(files.map((f) => f.extension))].sort(),
      hasOnnx: files.some((f) => f.extension === '.onnx'),
      manifestJson: manifestPath,
    },
    inputShapeHint:
      'ดูที่ models/facepsy.manifest.json (หรือ .example) ฟิลด์ auOnnx.inputShape',
    files,
  };

  fs.writeFileSync(OUT, JSON.stringify(inventory, null, 2), 'utf8');
  console.log(`Wrote ${path.relative(ROOT, OUT)} (${files.length} files)`);
}

main();
