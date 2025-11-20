import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Helper to convert Timestamps to serializable format
export const toSerializableObject = (obj: any): any => {
  if (obj == null) return obj;
  if (typeof obj !== 'object') return obj;

  // Explicitly handle Firestore Timestamps by checking for _seconds and _nanoseconds
  if (obj.hasOwnProperty('_seconds') && obj.hasOwnProperty('_nanoseconds') && typeof obj.toDate === 'function') {
      return obj.toDate().toISOString();
  }

  // Also handle the case where it might already be a Date object from other server logic
  if (obj instanceof Date) {
      return obj.toISOString();
  }

  if (Array.isArray(obj)) {
      return obj.map(toSerializableObject);
  }

  const newObj: { [key: string]: any } = {};
  for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
          newObj[key] = toSerializableObject(obj[key]);
      }
  }
  return newObj;
}
