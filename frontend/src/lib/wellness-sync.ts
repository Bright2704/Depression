/**
 * ซิงก์ข้อมูลจาก IndexedDB ไป API เมื่อผู้ใช้เปิด opt-in
 */
import {
  getAllLocalVectors,
  getAllLocalPhq9,
  clearLocalVectors,
  clearLocalPhq9,
} from '@/lib/wellness-indexeddb';
import { apiClient } from '@/lib/api-client';

export async function syncLocalWellnessToServer(): Promise<{ vectors: number; phq9: number }> {
  const settings = await apiClient.getWellnessSettings();
  if (!settings.success || !settings.data) {
    return { vectors: 0, phq9: 0 };
  }

  let vectorsSynced = 0;
  let phq9Synced = 0;

  if (settings.data.shareVectors) {
    const rows = await getAllLocalVectors();
    const done: string[] = [];
    for (const r of rows) {
      const res = await apiClient.submitVectorSample({
        vector: r.vector,
        dim: r.dim,
        timeEpoch: r.timeEpoch,
        sessionId: r.sessionId,
      });
      if (res.success) {
        done.push(r.id);
        vectorsSynced += 1;
      }
    }
    if (done.length) await clearLocalVectors(done);
  }

  if (settings.data.sharePhq9) {
    const rows = await getAllLocalPhq9();
    const done: string[] = [];
    for (const r of rows) {
      const res = await apiClient.submitPhq9Label({
        totalScore: r.totalScore,
        answers: r.answers,
      });
      if (res.success) {
        done.push(r.id);
        phq9Synced += 1;
      }
    }
    if (done.length) await clearLocalPhq9(done);
  }

  return { vectors: vectorsSynced, phq9: phq9Synced };
}
