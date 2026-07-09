export function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(value: number) {
  const hours = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (value % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function overlaps(startA: string, endA: string, startB: string, endB: string) {
  return timeToMinutes(startA) < timeToMinutes(endB) && timeToMinutes(endA) > timeToMinutes(startB);
}

export function isBefore(start: string, end: string) {
  return timeToMinutes(start) < timeToMinutes(end);
}

export function isWithin(innerStart: string, innerEnd: string, outerStart: string, outerEnd: string) {
  return timeToMinutes(innerStart) >= timeToMinutes(outerStart) && timeToMinutes(innerEnd) <= timeToMinutes(outerEnd);
}
