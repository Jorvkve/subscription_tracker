// Like Google Calendar's "this event / this and following / all events", for shifts.
// A series is every shift with the same title, start, end, and location, so shifts that
// were repeated before series existed still group together.

export type ShiftScope = "this" | "following" | "all";

export function parseShiftScope(value: FormDataEntryValue | null): ShiftScope {
  return value === "following" || value === "all" ? value : "this";
}

export type ShiftIdentity = { title: string; startTime: string; endTime: string; location: string | null };

/** The Prisma filter for the shifts a scope covers, given the chosen shift's current values. */
export function seriesWhere(shift: ShiftIdentity & { date: Date }, scope: Exclude<ShiftScope, "this">) {
  return {
    title: shift.title,
    startTime: shift.startTime,
    endTime: shift.endTime,
    location: shift.location,
    ...(scope === "following" ? { date: { gte: shift.date } } : {}),
  };
}

export type SeriesCounts = { following: number; all: number };

export function scopeOptions(counts: SeriesCounts): { value: ShiftScope; label: string }[] {
  const options: { value: ShiftScope; label: string }[] = [{ value: "this", label: "เฉพาะกะนี้" }];
  if (counts.following > 1 && counts.following < counts.all) {
    options.push({ value: "following", label: `กะนี้และกะถัดไปที่เหมือนกัน (${counts.following} กะ)` });
  }
  if (counts.all > 1) options.push({ value: "all", label: `ทุกกะที่เหมือนกัน (${counts.all} กะ)` });
  return options;
}
