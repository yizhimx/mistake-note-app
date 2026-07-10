export interface SM2Data {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewDate: string;
}

const MIN_EF = 1.3;

export function calculateSM2(
  quality: 0 | 1 | 2 | 3 | 4 | 5,
  prevData?: SM2Data | null,
): SM2Data {
  let ef = prevData?.easeFactor ?? 2.5;
  let interval = prevData?.interval ?? 0;
  let reps = prevData?.repetitions ?? 0;

  ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (ef < MIN_EF) ef = MIN_EF;

  if (quality < 3) {
    reps = 0;
    interval = 1;
  } else {
    reps += 1;
    if (reps === 1) {
      interval = 1;
    } else if (reps === 2) {
      interval = 6;
    } else {
      interval = Math.round(prevData!.interval * ef);
    }
  }

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + interval);

  return {
    easeFactor: Math.round(ef * 100) / 100,
    interval,
    repetitions: reps,
    nextReviewDate: nextDate.toISOString(),
  };
}

export function qualityFromLabel(
  label: 'fresh' | 'hesitant' | 'smooth',
): 0 | 1 | 2 | 3 | 4 | 5 {
  switch (label) {
    case 'fresh':
      return 1;
    case 'hesitant':
      return 3;
    case 'smooth':
      return 5;
  }
}
