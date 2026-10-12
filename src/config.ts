export const MAP_SIZE = 192;
export const IS_TOUCH = matchMedia('(pointer: coarse)').matches;

/** Height of one mountain step. */
export const LEVEL_H = 0.5;
export const WATER_BED = -0.4;
export const WATER_LEVEL = -0.1;

/** Real seconds per in-game day at 1x speed: 1 in-game hour = 1 minute (60 seconds) in real life. */
export const DAY_SECONDS = 24 * 60;
/** Each day is one month of the calendar; twelve days make a year. */
export const DAYS_PER_YEAR = 12;

