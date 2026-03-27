export interface FacePsyAuOnnxConfig {
  modelFile: string;
  inputName: string;
  inputShape: number[];
  outputName: string;
  outputDim: number;
}

export interface FacePsyManifest {
  version: number;
  auOnnxAvailable?: boolean;
  message?: string;
  auOnnx?: FacePsyAuOnnxConfig;
}

const DEFAULT_MANIFEST: FacePsyManifest = {
  version: 1,
  auOnnxAvailable: false,
};

export async function loadFacePsyManifest(basePath = '/models/facepsy'): Promise<FacePsyManifest> {
  if (typeof window === 'undefined') return DEFAULT_MANIFEST;
  try {
    const res = await fetch(`${basePath}/facepsy.manifest.json`, { cache: 'no-store' });
    if (!res.ok) return DEFAULT_MANIFEST;
    const data = (await res.json()) as FacePsyManifest;
    return data;
  } catch {
    return DEFAULT_MANIFEST;
  }
}
