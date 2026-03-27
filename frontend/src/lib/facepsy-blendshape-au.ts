import type { ActionUnits } from '@/lib/facepsy-types';

/** Blendshape category จาก MediaPipe Face Landmarker */
export function blendshapesToActionUnits(categories: { categoryName?: string; score?: number }[]): ActionUnits {
  const get = (name: string) => {
    const c = categories.find(
      (b) => (b.categoryName || '').toLowerCase() === name.toLowerCase()
    );
    return c?.score ?? 0;
  };

  const mouthSmile = (get('mouthSmileLeft') + get('mouthSmileRight')) / 2;
  const cheekSquint = (get('cheekSquintLeft') + get('cheekSquintRight')) / 2;
  const browDown = (get('browDownLeft') + get('browDownRight')) / 2;
  const browInnerUp = get('browInnerUp');
  const browOuterUp = (get('browOuterUpLeft') + get('browOuterUpRight')) / 2;
  const mouthFrown = (get('mouthFrownLeft') + get('mouthFrownRight')) / 2;
  const eyeSquint = (get('eyeSquintLeft') + get('eyeSquintRight')) / 2;
  const mouthPress = (get('mouthPressLeft') + get('mouthPressRight')) / 2;

  return {
    AU01: Math.max(0, Math.min(1, browInnerUp)),
    AU02: Math.max(0, Math.min(1, browOuterUp)),
    AU04: Math.max(0, Math.min(1, browDown)),
    AU06: Math.max(0, Math.min(1, cheekSquint)),
    AU07: Math.max(0, Math.min(1, eyeSquint)),
    AU10: Math.max(0, Math.min(1, get('mouthUpperUp'))),
    AU12: Math.max(0, Math.min(1, mouthSmile)),
    AU14: Math.max(0, Math.min(1, get('mouthDimpleLeft') + get('mouthDimpleRight')) / 2),
    AU15: Math.max(0, Math.min(1, mouthFrown)),
    AU17: Math.max(0, Math.min(1, get('mouthShrugLower'))),
    AU23: Math.max(0, Math.min(1, mouthPress)),
    AU24: Math.max(0, Math.min(1, mouthPress * 0.9)),
  };
}
