function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function shouldRunDailyDigest(lastRunIso: string | undefined): boolean {
  if (!lastRunIso) return true;
  return !isSameDay(new Date(lastRunIso), new Date());
}

export function shouldRunWeeklyDigest(lastRunIso: string | undefined): boolean {
  const now = new Date();
  if (now.getDay() !== 1) return false;
  if (!lastRunIso) return true;
  return !isSameDay(new Date(lastRunIso), now);
}

export function previousDayRange(): { start: Date; end: Date } {
  const end = startOfDay(new Date());
  const start = new Date(end);
  start.setDate(start.getDate() - 1);
  return { start, end };
}

export function previousWeekRange(): { start: Date; end: Date } {
  const end = startOfDay(new Date());
  const start = new Date(end);
  start.setDate(start.getDate() - 7);
  return { start, end };
}
