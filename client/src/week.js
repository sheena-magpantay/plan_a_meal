export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const pad = (n) => String(n).padStart(2, "0");
const toIsoDate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;


export function currentWeekStart(now = new Date()) {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return toIsoDate(monday);
}

export function weekDates(weekStart) {
  const [year, month, day] = weekStart.split("-").map(Number);
  return DAYS.map((_, index) => new Date(year, month - 1, day + index));
}

export function todayName(now = new Date()) {
  return DAYS[(now.getDay() + 6) % 7];
}

const short = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" });

export function formatWeekRange(weekStart) {
  const dates = weekDates(weekStart);
  return `${short.format(dates[0])} – ${short.format(dates[6])}`;
}

export const formatShortDate = (date) => short.format(date);
