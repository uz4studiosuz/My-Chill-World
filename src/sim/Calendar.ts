import { DAYS_PER_YEAR } from '../config';
import { t } from '../i18n/i18n';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The first year of every world is this calendar year (people's birthdays and documents count from it). */
export const FIRST_YEAR = 2026;
/** The calendar year of a game day (day 1 is March of FIRST_YEAR; days before it are the past). */
export function calendarYear(day: number) {
  return FIRST_YEAR - 1 + yearOf(day);
}

/** A game day as people read it: the month and the year ("March 2027"); one game day is one month. */
export function dateLabel(day: number) {
  return `${t(MONTH_NAMES[monthOf(day)])} ${calendarYear(day)}`;
}

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/** Day 1 is March of year 1 (start of spring). */
const START_MONTH = 2;

export function monthOf(day: number) {
  return (((day - 1 + START_MONTH) % DAYS_PER_YEAR) + DAYS_PER_YEAR) % DAYS_PER_YEAR;
}

export function yearOf(day: number) {
  return Math.floor((day - 1 + START_MONTH) / DAYS_PER_YEAR) + 1;
}

export function seasonOf(month: number): Season {
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

/**
 * Continuous season blend for visuals: 0 = mid-winter … 1 = mid-summer,
 * plus separate weights for autumn colours and snow.
 */
export function seasonBlend(day: number, timeOfDay: number) {
  const m = (monthOf(day) + timeOfDay) % 12; // 0 = January
  const snow = clamp01(m < 2.2 ? 1 - Math.max(0, m - 1.4) / 0.8 : m > 11 ? (m - 11) / 0.8 : 0);
  const autumn = clamp01(m < 8 ? 0 : m < 9 ? m - 8 : m < 10.6 ? 1 : 1 - (m - 10.6) / 0.6);
  const bare = clamp01(m < 2 ? 1 : m < 3 ? 3 - m : m > 10.6 ? (m - 10.6) / 0.6 : 0);
  const spring = clamp01(m >= 2.2 && m < 5 ? 1 - Math.abs(m - 3.5) / 1.5 : 0);
  return { snow, autumn, bare, spring };
}

/** Crops grow from March to October. */
export const growingSeason = (month: number) => month >= 2 && month <= 9;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
