import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { addDays, setHours, setMinutes, getDay, isBefore, startOfDay } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateNextRunDate(daysOfWeek: number[], time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const now = new Date();
  const todayIndex = getDay(now);

  // Sort days to ensure order
  const sortedDays = [...daysOfWeek].sort((a, b) => a - b);

  // Find the next day in the current week
  let nextDayIndex = sortedDays.find(day => day > todayIndex);

  // If no day left in this week, take the first day of next week
  if (nextDayIndex === undefined) {
    nextDayIndex = sortedDays[0];
  }

  let nextDate = new Date();

  if (nextDayIndex > todayIndex) {
    // Next day is in the same week
    nextDate = addDays(now, nextDayIndex - todayIndex);
  } else {
    // Next day is in the next week
    nextDate = addDays(now, 7 - (todayIndex - nextDayIndex));
  }

  // Set time
  nextDate = setHours(nextDate, hours);
  nextDate = setMinutes(nextDate, minutes);
  nextDate = setSeconds(nextDate, 0);
  nextDate = setMilliseconds(nextDate, 0);

  // If the calculated next date is in the past (e.g. we are on the same day but later time), 
  // and we logic above didn't handle "same day" correctly for time:
  // The logic above:
  // If today is Monday (1) and we select Monday (1). 
  // nextDayIndex (find > 1) -> undefined.
  // nextDayIndex becomes 1.
  // nextDayIndex (1) > todayIndex (1) is False.
  // nextDate = addDays(now, 7 - 0) = next week Monday.
  // This is correct for "strictly after today".

  // However, if we want to support "Today if time hasn't passed", that's different.
  // But usually for recurrence, we create the *first* one immediately (manually), 
  // and the *recurrence* handles the *next* ones. 
  // So strictly future is correct.

  return nextDate;
}

function setSeconds(date: Date, seconds: number): Date {
  const d = new Date(date);
  d.setSeconds(seconds);
  return d;
}

function setMilliseconds(date: Date, ms: number): Date {
  const d = new Date(date);
  d.setMilliseconds(ms);
  return d;
}
