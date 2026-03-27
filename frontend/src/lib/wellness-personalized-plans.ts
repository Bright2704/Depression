/**
 * แผนดูแลตัวเองแบบหลากหลาย — ผูกช่วงเวลาที่สแกน + ระดับผลของผู้ใช้
 */
import type { PHQ9Prediction } from '@/lib/phq9-predictor';

/** สอดคล้องกับ WellnessScore ใน WellnessResult (ไม่ import จาก component เพื่อหลีกเลี่ยงวงจร) */
export interface WellnessSnapshot {
  energy: number;
  stress: number;
  fatigue: number;
  emotionalBalance: number;
  overall: 'excellent' | 'good' | 'attention' | 'concern';
}

export type UserResultTier = 'low' | 'moderate' | 'elevated' | 'high';

export type NightPhase = 'none' | 'late_evening' | 'after_midnight';

export interface TimeSlice {
  period: 'morning' | 'afternoon' | 'evening' | 'night';
  hour: number;
  minute: number;
  nightPhase: NightPhase;
}

function hashSeed(ts: number, score: number, stress: number): number {
  return Math.abs(Math.floor(ts / 60000) + score * 31 + stress * 17);
}

export function deriveUserTier(prediction: PHQ9Prediction, wellness: WellnessSnapshot): UserResultTier {
  const s = prediction.score;
  if (s >= 15 || wellness.overall === 'concern') return 'high';
  if (s >= 10 || wellness.overall === 'attention') return 'elevated';
  if (s >= 5 || wellness.stress > 55 || wellness.fatigue > 55) return 'moderate';
  return 'low';
}

export function getTimeSlice(timestamp: number): TimeSlice {
  const d = new Date(timestamp);
  const hour = d.getHours();
  const minute = d.getMinutes();
  let period: TimeSlice['period'];
  let nightPhase: NightPhase = 'none';

  if (hour >= 5 && hour < 12) period = 'morning';
  else if (hour >= 12 && hour < 17) period = 'afternoon';
  else if (hour >= 17 && hour < 21) period = 'evening';
  else {
    period = 'night';
    if (hour >= 21) nightPhase = 'late_evening';
    else if (hour < 5) nightPhase = 'after_midnight';
  }

  return { period, hour, minute, nightPhase };
}

function pick<T>(items: T[], seed: number): T {
  if (items.length === 0) return undefined as T;
  return items[seed % items.length];
}

/** ข้อความหัวการ์ด “ช่วงนี้” — ปรับตามดึก + ระดับผล */
export function getPersonalizedMomentTip(
  slice: TimeSlice,
  tier: UserResultTier,
  wellness: WellnessSnapshot,
  seed: number
): string {
  const { period, nightPhase, hour, minute } = slice;
  const t = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} น.`;

  if (period === 'night' && nightPhase === 'after_midnight') {
    const crisis =
      tier === 'high' || tier === 'elevated'
        ? [
            `ตอนนี้ ${t} แล้ว — ร่างกายควรได้พักฟื้น ถ้าคุณยังรู้สึกหนักหน่วงหรือคิดวนซ้ำ ลองหยุดใช้หน้าจอ 15 นาที แล้วหายใจยาว ๆ หรือโทรหาคนที่ไว้ใจได้`,
            `ช่วงหลังเที่ยงคืนตี ${hour} น. เป็นช่วงที่สมองควรพัก หากอารมณ์ต่ำหรือเครียดสูง ให้ถือว่า “พรุ่งนี้ค่อยจัดการ” แล้วพยายามนอนหรือพักสายตาแทนการเลื่อนโซเชียล`,
            `เวลานี้ (${t}) เหมาะกับการปิดแสงจ้า ดื่มน้ำอุ่น และบอกตัวเองว่าคุณทำดีที่สังเกตตัวเองแล้ว — ถ้ามีความคิดทำร้ายตัวเอง โทร 1323 ได้ตลอด 24 ชม.`,
          ]
        : [
            `ตอนนี้ ${t} ช่วงดึกหลังเที่ยงคืน — แนะนำให้ลดแสงหน้าจอและเตรียมพักผ่อน แม้จะยังไม่ง่วงก็ช่วยให้นาฬิกาชีวิตดีขึ้น`,
            `ดึกแบบนี้ (${t}) ร่างกายกำลังหลั่งเมลาโทนิน ลองปิดมือถือสักครู่แล้วหายใจช้า ๆ 4-6 ครั้ง`,
            `หลังเที่ยงคืนแล้ว ถ้ายังไม่ง่วง ลองฟังเสียงขาว / ยืดคอไหล่เบา ๆ แทนการจ้องจอ`,
          ];
    return pick(crisis, seed);
  }

  if (period === 'night' && nightPhase === 'late_evening') {
    const pool =
      tier === 'high' || tier === 'elevated'
        ? [
            `ช่วงค่ำปลายวัน (${t}) ความเครียดอาจสะสม ลองจดสิ่งที่ทำสำเร็จวันนี้ 1 ข้อ แล้วปล่อยวางสิ่งที่ยังค้าง`,
            `ก่อนเที่ยงคืน (${t}) เหมาะกับกิจกรรมผ่อนคลายแบบไม่ใช้หน้าจอ เช่น อาบน้ำอุ่นหรือยืดตัว`,
          ]
        : [
            `ช่วงก่อนนอน (${t}) ลองตั้งเวลา “เลิกจอ” 30 นาทีก่อนนอน`,
            `เย็นวันนี้ (${t}) เหมาะกับทบทวนวันแบบสั้น ๆ: อะไรที่ทำให้โล่งใจที่สุดวันนี้?`,
          ];
    return pick(pool, seed);
  }

  if (period === 'morning') {
    return pick(
      [
        `ช่วงเช้า (${t}) เหมาะกับรับแสงธรรมชาติสั้น ๆ 5–10 นาที ช่วยตั้งนาฬิกาชีวิต`,
        `เช้านี้ (${t}) ถ้าพลังงาน${wellness.energy < 55 ? 'ยังไม่เต็มที่' : 'พอใช้ได้'} ลองดื่มน้ำ 1 แก้วก่อนเริ่มวัน`,
      ],
      seed
    );
  }

  if (period === 'afternoon') {
    return pick(
      [
        `ช่วงบ่าย (${t}) หากรู้สึกง่วงเล็กน้อยเป็นเรื่องปกติ ลองเดิน 5 นาทีหรืองีบไม่เกิน 20 นาที`,
        `บ่ายนี้ (${t}) เหมาะกับจัดลำดับงานเบา ๆ หลังมื้อเที่ยง`,
      ],
      seed
    );
  }

  if (period === 'evening') {
    return pick(
      [
        `ช่วงเย็น (${t}) ค่อย ๆ ผ่อนจังหวะจากงาน แยกเวลา “พักสมอง” ก่อนมื้อเย็น`,
        `เย็นวันนี้ (${t}) ลองทำกิจกรรมที่ไม่ใช้หน้าจอสัก 20 นาที`,
      ],
      seed
    );
  }

  return pick(
    [
      `ช่วงนี้ (${t}) ลองสังเกตว่าร่างกายต้องการพักหรือขยับ — เลือกอย่างใดอย่างหนึ่งที่เหมาะกับคุณ`,
      `เวลานี้ (${t}) เหมาะกับหายใจลึก ๆ สักครู่แล้วค่อยทำกิจกรรมถัดไป`,
    ],
    seed
  );
}

export interface PersonalizedPlanInput {
  prediction: PHQ9Prediction;
  wellness: WellnessSnapshot;
  slice: TimeSlice;
  checkin?: { sleepQuality: number; stressLevel: number; energyLevel: number };
  scanTimestamp: number;
  modelRecs: string[];
}

export function buildPersonalizedRecommendations(input: PersonalizedPlanInput): {
  immediate: string[];
  today: string[];
  thisWeek: string[];
} {
  const { prediction, wellness, slice, checkin, scanTimestamp, modelRecs } = input;
  const tier = deriveUserTier(prediction, wellness);
  const seed = hashSeed(scanTimestamp, prediction.score, wellness.stress);

  const immediate: string[] = [];
  const today: string[] = [];
  const thisWeek: string[] = [];

  const push = (list: string[], ...items: (string | undefined)[]) => {
    for (const s of items) {
      if (s && !list.includes(s)) list.push(s);
    }
  };

  if (modelRecs[0]) push(immediate, modelRecs[0]);
  if (prediction.score >= 10) {
    if (modelRecs[1]) push(immediate, modelRecs[1]);
  } else if (modelRecs[1]) {
    push(today, modelRecs[1]);
  }

  const p = slice.period;
  const np = slice.nightPhase;

  // --- Immediate: ช่วงเวลา + tier ---
  if (p === 'morning') {
    push(
      immediate,
      pick(
        [
          'ดื่มน้ำเปล่า 1 แก้ว แล้วออกไปรับแสงธรรมชาติ 5–10 นาที',
          'ยืดคอ ไหล่ และหลังเบา ๆ สัก 2 นาทีก่อนเริ่มงาน',
        ],
        seed
      )
    );
    if (wellness.energy < 50) {
      push(immediate, 'ถ้ายังงัวงง ลองสูดอากาศบริสุทธิ์ใกล้หน้าต่างสักครู่');
    }
  } else if (p === 'afternoon') {
    push(
      immediate,
      pick(
        [
          'เดินเล่นกลางแจ้ง 5 นาที หรือลุกยืดขาเพื่อเลี่ยงง่วงหลังมื้อเที่ยง',
          'ดื่มน้ำและเลือกของว่างที่มีโปรตีนเล็กน้อย',
        ],
        seed + 1
      )
    );
    if (wellness.fatigue > 50) {
      push(immediate, 'งีบไม่เกิน 20 นาที จะช่วยลดความเหนื่อยช่วงบ่าย');
    }
  } else if (p === 'evening') {
    push(
      immediate,
      pick(
        [
          'แยกเวลาเลิกงานชัดเจน แล้วทำกิจกรรมผ่อนคลายที่ไม่ใช้จอ 15 นาที',
          'จดสิ่งที่ทำสำเร็จวันนี้ 1–3 ข้อ แล้วปล่อยวางเรื่องที่ค้าง',
        ],
        seed + 2
      )
    );
    if (wellness.stress > 50) {
      push(immediate, 'หายใจ 4-4-6: สูด 4 วิ กลั้น 4 วิ ปล่อย 6 วิ ทำ 3 รอบ');
    }
  } else if (p === 'night') {
    if (np === 'after_midnight') {
      const deep =
        tier === 'high' || tier === 'elevated'
          ? [
              'ตอนนี้ดึกมากแล้ว — แนะนำให้หยุดงาน/โซเชียล ลดแสงจ้า และมุ่งเป้าไปที่การพักผ่อน',
              'ถ้าอารมณ์หนักหน่วงหรือคิดวนซ้ำ ลองเขียนความกังวลลงกระดาษ 1 หน้า แล้ววางปากกา — พรุ่งนี้ค่อยจัดการต่อ',
              'หากมีความคิดทำร้ายตัวเองหรือรู้สึกไม่ปลอดภัย โทรสายด่วนสุขภาพจิต 1323 (24 ชม.) หรือขอความช่วยเหลือจากคนใกล้ชิดทันที',
            ]
          : [
              'หลังเที่ยงคืนแล้ว — ลดแสงหน้าจอและหลีกเลี่ยงเนื้อหาตื่นเต้น ช่วยให้นอนตื่นง่ายขึ้นพรุ่งนี้',
              'ลองฟังเสียงขาว/เพลงเบา ๆ หรือยืดคอไหล่ก่อนนอน',
              'ดื่มน้ำอุ่นเล็กน้อย (ไม่ใช่คาเฟอีน) แล้วตั้งเวลาปลุกให้สม่ำเสมอพรุ่งนี้',
            ];
      push(immediate, pick(deep, seed));
      if (wellness.fatigue > 55) {
        push(immediate, 'ความเหนื่อยสะสม + การนอนดึกไปด้วยกันเสี่ยงทำให้พรุ่งนี้หนักกว่าเดิม — พยายามนอนเร็วที่สุดเท่าที่ทำได้คืนนี้');
      }
    } else {
      push(
        immediate,
        pick(
          [
            'ก่อนเที่ยงคืน — เริ่ม “โหมดก่อนนอน”: หรี่ไฟ ลดเสียง ลดจอ',
            'อาบน้ำอุ่นหรืออ่านหนังสือกระดาษแทนการเลื่อนมือถือ',
          ],
          seed + 3
        )
      );
    }
  }

  if (wellness.stress > 60) {
    push(
      immediate,
      pick(
        [
          'หายใจกล่อง: สูดเข้า 4 วิ — กลั้น 4 วิ — ปล่อยยาว 6 วิ ทำ 4 รอบ',
          'บีบปล่อยกำปั้น 5 วินาที แล้วคลาย ทำซ้ำ 5 ครั้ง',
        ],
        seed + 4
      )
    );
  }

  // --- Today ---
  if (tier === 'high' || tier === 'elevated') {
    push(
      today,
      pick(
        [
          'วันนี้หลีกเลี่ยงการตัดสินใจใหญ่หรือข้อความที่อาจทำให้เครียดเพิ่ม',
          'แจ้งคนใกล้ชิด 1 คนว่าคุณกำลังเหนื่อยจิตใจ — ไม่ต้องละเอียด แค่ขออยู่ใกล้ ๆ',
        ],
        seed
      )
    );
  }
  if (p === 'morning' || p === 'afternoon') {
    if (wellness.energy < 60) {
      push(today, 'วันนี้จัดเวลาเดินกลางแจ้งรวม 15–20 นาที');
    }
    push(today, pick(['กำหนดเวลาเลิกงานที่ชัดเจน', 'แบ่งงานเป็นก้อนเล็ก ๆ ทำทีละอย่าง'], seed + 5));
  } else {
    push(today, 'คืนนี้พยายามนอนเร็วกว่าปกติ 15–30 นาที');
    if (checkin && checkin.sleepQuality <= 3) {
      push(today, 'ปิดหน้าจอทุกชนิดก่อนนอนอย่างน้อย 45–60 นาที');
    }
    if (np === 'after_midnight') {
      push(
        today,
        pick(
          [
            'พรุ่งนี้ตื่นแล้วรับแสงเช้า 5–10 นาที จะช่วยชดเชยการนอนดึกคืนนี้',
            'พรุ่งนี้หลีกเลี่ยงคาเฟอีนหนักหลังบ่าย เพื่อให้นอนง่ายขึ้น',
          ],
          seed + 6
        )
      );
    }
  }

  // --- This week ---
  push(thisWeek, pick(['เช็คอินสุขภาวะอารมณ์อีกครั้งภายใน 2–3 วัน เพื่อดูแนวโน้ม', 'บันทึก 1 บรรทัดต่อวันว่าอะไรช่วยให้อาการดีขึ้น'], seed));
  if (wellness.fatigue > 50 || (checkin && checkin.sleepQuality <= 3)) {
    push(
      thisWeek,
      pick(
        [
          'ปรับกิจวัตรก่อนนอน: ห้องมืด เย็น นอนเวลาใกล้เคียงกันทุกวัน',
          'ลดคาเฟอีนหลัง 14:00 น. และลดแอลกอฮอล์ก่อนนอน',
        ],
        seed + 7
      )
    );
  }
  push(thisWeek, 'เคลื่อนไหวเบา ๆ อย่างน้อย 3 ครั้ง/สัปดาห์ ครั้งละ 20 นาที');
  if (wellness.stress > 50) {
    push(thisWeek, pick(['ฝึกสติหรือไล่ความคิด 5–10 นาที/วัน', 'ลอง journaling 3 บรรทัดก่อนนอน'], seed + 8));
  }
  if (tier === 'elevated' || tier === 'high') {
    push(
      thisWeek,
      pick(
        [
          'พิจารณานัดพูดคุยกับนักจิตวิทยาหรือแพทย์ถ้าอาการคงอยู่หรือแย่ลง',
          'เก็บหมายเลขฉุกเฉินสุขภาพจิต (1323) ไว้ในมือถือ',
        ],
        seed + 9
      )
    );
  }

  return {
    immediate: immediate.slice(0, 4),
    today: today.slice(0, 4),
    thisWeek: thisWeek.slice(0, 4),
  };
}
