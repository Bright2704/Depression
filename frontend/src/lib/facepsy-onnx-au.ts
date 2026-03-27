import type { FacePsyAuOnnxConfig, FacePsyManifest } from './facepsy-manifest';
import type { ActionUnits } from '@/lib/facepsy-types';

type OrtModule = typeof import('onnxruntime-web');

const AU_KEYS: (keyof ActionUnits)[] = [
  'AU01',
  'AU02',
  'AU04',
  'AU06',
  'AU07',
  'AU10',
  'AU12',
  'AU14',
  'AU15',
  'AU17',
  'AU23',
  'AU24',
];

let ortPromise: Promise<OrtModule> | null = null;

function loadOrt(): Promise<OrtModule> {
  if (!ortPromise) {
    ortPromise = import('onnxruntime-web').then((ort) => {
      if (typeof window !== 'undefined') {
        const ver = '1.17.3';
        ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ver}/dist/`;
      }
      return ort;
    });
  }
  return ortPromise;
}

function flattenLandmarksNormalized(
  landmarks: { x: number; y: number; z: number }[]
): Float32Array {
  const n = landmarks.length;
  const out = new Float32Array(n * 3);
  let i = 0;
  for (const lm of landmarks) {
    out[i++] = lm.x;
    out[i++] = lm.y;
    out[i++] = lm.z;
  }
  return out;
}

function fitTensorLength(flat: Float32Array, expected: number): Float32Array {
  if (flat.length === expected) return flat;
  const out = new Float32Array(expected);
  out.set(flat.subarray(0, Math.min(flat.length, expected)));
  return out;
}

export class FacePsyOnnxAu {
  private session: import('onnxruntime-web').InferenceSession | null = null;

  private constructor(
    private readonly config: FacePsyAuOnnxConfig,
    private readonly basePath: string,
    session: import('onnxruntime-web').InferenceSession
  ) {
    this.session = session;
  }

  static async create(manifest: FacePsyManifest, basePath = '/models/facepsy'): Promise<FacePsyOnnxAu | null> {
    if (!manifest.auOnnxAvailable || !manifest.auOnnx) return null;
    const cfg = manifest.auOnnx;
    try {
      const ort = await loadOrt();
      const modelUrl = `${basePath}/${cfg.modelFile}`;
      const session = await ort.InferenceSession.create(modelUrl, {
        executionProviders: ['wasm'],
      });
      return new FacePsyOnnxAu(cfg, basePath, session);
    } catch {
      return null;
    }
  }

  async infer(landmarks: { x: number; y: number; z: number }[]): Promise<Partial<ActionUnits> | null> {
    if (!this.session) return null;
    const cfg = this.config;
    const expected = cfg.inputShape.reduce((a, b) => a * b, 1);
    const flat = flattenLandmarksNormalized(landmarks);
    const inputData = fitTensorLength(flat, expected);
    const ort = await loadOrt();
    const tensor = new ort.Tensor('float32', inputData, cfg.inputShape);
    const feeds: Record<string, import('onnxruntime-web').Tensor> = {
      [cfg.inputName]: tensor,
    };
    const out = await this.session.run(feeds);
    const outTensor = out[cfg.outputName];
    if (!outTensor || !outTensor.data) return null;
    const data = outTensor.data as Float32Array;
    const dim = Math.min(cfg.outputDim, data.length, AU_KEYS.length);
    const result: Partial<ActionUnits> = {};
    for (let i = 0; i < dim; i++) {
      let v = data[i];
      if (v < 0 || v > 1) v = 1 / (1 + Math.exp(-v));
      result[AU_KEYS[i]] = Math.max(0, Math.min(1, v));
    }
    return result;
  }

  dispose(): void {
    this.session = null;
  }
}

export function mergeActionUnits(base: ActionUnits, patch: Partial<ActionUnits> | null): ActionUnits {
  if (!patch) return base;
  return { ...base, ...patch };
}
