export function createId(prefix: string): string {
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rnd}`;
}
