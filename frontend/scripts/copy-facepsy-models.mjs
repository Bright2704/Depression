#!/usr/bin/env node
/**
 * คัดลอก ONNX + metadata จาก models/ → public/models/facepsy/
 * รองรับ repo (มีโฟลเดอร์ frontend/) และ Docker แบบแบน (/app)
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
const SRC = path.join(ROOT, 'models');
const publicRoot = fs.existsSync(path.join(ROOT, 'frontend', 'public'))
  ? path.join(ROOT, 'frontend', 'public')
  : path.join(ROOT, 'public');
const DEST = path.join(publicRoot, 'models', 'facepsy');

const ALLOWED_EXT = new Set(['.onnx', '.json', '.task', '.txt']);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyRecursive(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) {
    console.warn(`[copy-facepsy-models] ไม่พบ ${srcDir} — ข้ามการคัดลอก`);
    return { copied: 0 };
  }

  ensureDir(destDir);
  let copied = 0;

  const walk = (rel = '') => {
    const abs = path.join(srcDir, rel);
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      for (const name of fs.readdirSync(abs)) {
        walk(path.join(rel, name));
      }
      return;
    }
    const ext = path.extname(abs).toLowerCase();
    if (!ALLOWED_EXT.has(ext) && ext !== '') return;
    const base = path.basename(abs);
    if (base === 'inventory.json' || base.endsWith('.example.json')) return;

    const outRel = rel;
    const destPath = path.join(destDir, outRel);
    ensureDir(path.dirname(destPath));
    fs.copyFileSync(abs, destPath);
    copied += 1;
  };

  walk('');
  return { copied };
}

function writePlaceholderManifest() {
  const placeholder = {
    version: 1,
    auOnnxAvailable: false,
    message:
      'ยังไม่มีไฟล์โมเดลใน models/ — วาง au.onnx และ facepsy.manifest.json แล้วรัน npm run copy-models',
  };
  const destManifest = path.join(DEST, 'facepsy.manifest.json');
  if (!fs.existsSync(destManifest)) {
    ensureDir(DEST);
    fs.writeFileSync(destManifest, JSON.stringify(placeholder, null, 2), 'utf8');
    console.log('[copy-facepsy-models] สร้าง placeholder facepsy.manifest.json');
  }
}

function main() {
  ensureDir(DEST);
  const { copied } = copyRecursive(SRC, DEST);
  writePlaceholderManifest();
  console.log(`[copy-facepsy-models] คัดลอก ${copied} ไฟล์ → ${path.relative(ROOT, DEST)}`);
}

main();
