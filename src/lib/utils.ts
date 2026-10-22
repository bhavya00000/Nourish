export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export const fmt = (n: number, digits = 0) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Quantities look wrong with a trailing ".0", but 1.5 must keep its half. */
export const qty = (n: number) => (Number(n) % 1 === 0 ? String(Number(n)) : String(Number(n).toFixed(2).replace(/0+$/, "").replace(/\.$/, "")));

/**
 * A day as YYYY-MM-DD in local time. toISOString() alone gives the UTC day,
 * which in India is still yesterday until 5:30 am.
 */
export const localISO = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export const todayISO = () => localISO(new Date());

export const shiftDate = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localISO(d);
};

export function prettyDate(iso: string) {
  const today = todayISO();
  if (iso === today) return "Today";
  if (iso === shiftDate(today, -1)) return "Yesterday";
  if (iso === shiftDate(today, 1)) return "Tomorrow";
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function shortDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function timeOfDay(value: string | Date) {
  return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export const MEAL_META = [
  { key: "breakfast", label: "Breakfast", hint: "e.g. 2 paratha and 1 cup chai" },
  { key: "lunch", label: "Lunch", hint: "e.g. 3 roti, 1 katori dal, salad" },
  { key: "snacks", label: "Snacks", hint: "e.g. 1 apple and 10 almonds" },
  { key: "dinner", label: "Dinner", hint: "e.g. 200 g paneer and 2 roti" },
  { key: "event", label: "Outside / event", hint: "e.g. 2 slice pizza and 1 cola" },
] as const;

export type MealKey = (typeof MEAL_META)[number]["key"];
