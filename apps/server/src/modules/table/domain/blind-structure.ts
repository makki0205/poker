export interface BlindLevel {
  level: number;
  sb: number;
  bb: number;
  ante: number;
  untilMinute: number;
}

const thirtyMinuteLevels: BlindLevel[] = [
  { level: 1, sb: 100, bb: 200, ante: 25, untilMinute: 5 },
  { level: 2, sb: 200, bb: 400, ante: 50, untilMinute: 10 },
  { level: 3, sb: 300, bb: 600, ante: 75, untilMinute: 15 },
  { level: 4, sb: 500, bb: 1000, ante: 100, untilMinute: 20 },
  { level: 5, sb: 800, bb: 1600, ante: 200, untilMinute: 25 },
  { level: 6, sb: 1200, bb: 2400, ante: 300, untilMinute: 30 }
];

const sixtyMinuteLevels: BlindLevel[] = [
  { level: 1, sb: 100, bb: 200, ante: 25, untilMinute: 10 },
  { level: 2, sb: 150, bb: 300, ante: 50, untilMinute: 20 },
  { level: 3, sb: 200, bb: 400, ante: 50, untilMinute: 30 },
  { level: 4, sb: 300, bb: 600, ante: 75, untilMinute: 40 },
  { level: 5, sb: 500, bb: 1000, ante: 100, untilMinute: 50 },
  { level: 6, sb: 800, bb: 1600, ante: 200, untilMinute: 60 }
];

const ninetyMinuteLevels: BlindLevel[] = [
  { level: 1, sb: 100, bb: 200, ante: 25, untilMinute: 15 },
  { level: 2, sb: 150, bb: 300, ante: 25, untilMinute: 30 },
  { level: 3, sb: 200, bb: 400, ante: 50, untilMinute: 45 },
  { level: 4, sb: 300, bb: 600, ante: 75, untilMinute: 60 },
  { level: 5, sb: 500, bb: 1000, ante: 100, untilMinute: 75 },
  { level: 6, sb: 700, bb: 1400, ante: 200, untilMinute: 90 }
];

export function getBlindStructure(duration: 30 | 60 | 90): BlindLevel[] {
  if (duration === 30) {
    return thirtyMinuteLevels;
  }
  if (duration === 60) {
    return sixtyMinuteLevels;
  }
  return ninetyMinuteLevels;
}

export function getBlindAtMinute(duration: 30 | 60 | 90, elapsedMinutes: number): BlindLevel {
  const levels = getBlindStructure(duration);
  for (const level of levels) {
    if (elapsedMinutes <= level.untilMinute) {
      return level;
    }
  }
  return levels[levels.length - 1] as BlindLevel;
}
