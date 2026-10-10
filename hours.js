export const defaultHours = () => ({ week: Array.from({ length: 7 }, () => ({ open: '10:00', close: '20:30', closed: false })), dates: {} });
const minutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const madridParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function validateHours(value) {
  const validDay = day => day && typeof day.closed === 'boolean' && /^\d{2}:\d{2}$/.test(day.open) && /^\d{2}:\d{2}$/.test(day.close) && minutes(day.open) >= 0 && minutes(day.close) <= 1439 && Number(day.open.slice(3)) < 60 && Number(day.close.slice(3)) < 60 && minutes(day.open) < minutes(day.close);
  if (!value || !Array.isArray(value.week) || value.week.length !== 7 || !value.week.every(validDay) || value.week.every(day => day.closed) || !value.dates || Array.isArray(value.dates) || typeof value.dates !== 'object' || Object.keys(value.dates).length > 366) throw new Error('INVALID_HOURS');
  for (const [date, day] of Object.entries(value.dates)) if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !validDay(day)) throw new Error('INVALID_HOURS');
  return value;
}
export function dayHours(date, hours = defaultHours()) {
  const parts = madridParts.formatToParts(date);
  const part = type => parts.find(item => item.type === type).value;
  const key = `${part('year')}-${part('month')}-${part('day')}`;
  const weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
  const day = hours.dates[key] || hours.week[weekday];
  return { ...day, minute: Number(part('hour')) * 60 + Number(part('minute')), start: minutes(day.open), end: minutes(day.close) };
}
export function isWorking(date, hours, includeClosing = false) {
  const day = dayHours(date, hours);
  return !day.closed && day.minute >= day.start && (includeClosing ? day.minute <= day.end : day.minute < day.end);
}
export function workingReady(from = new Date(), lead = 300, hours = defaultHours()) {
  const cursor = new Date(Math.ceil(from.getTime() / 60000) * 60000);
  let remaining = lead;
  // Bound the search even if exceptions close the shop for a long period.
  for (let step = 0; step < 400 * 1440; step++) {
    if (remaining <= 0 && isWorking(cursor, hours, true)) return cursor;
    if (isWorking(cursor, hours)) remaining--;
    cursor.setTime(cursor.getTime() + 60000);
  }
  throw new Error('INVALID_HOURS');
}
