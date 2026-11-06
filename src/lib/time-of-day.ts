export function parseTimeOfDay(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("รูปแบบเวลาไม่ถูกต้อง ต้องเป็น HH:mm");
  }
  const trimmed = value.trim();
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(trimmed)) {
    throw new Error("รูปแบบเวลาไม่ถูกต้อง ต้องเป็น HH:mm ระหว่าง 00:00 ถึง 23:59");
  }
  return trimmed;
}

export function shiftDurationMinutes(start: string, end: string): number {
  const parsedStart = parseTimeOfDay(start);
  const parsedEnd = parseTimeOfDay(end);
  const [startH, startM] = parsedStart.split(":").map(Number);
  const [endH, endM] = parsedEnd.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  let diff = endMinutes - startMinutes;
  if (diff <= 0) {
    diff += 24 * 60;
  }
  return diff;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes} นาที`;
  if (remainingMinutes === 0) return `${hours} ชม.`;
  return `${hours} ชม. ${remainingMinutes} นาที`;
}
