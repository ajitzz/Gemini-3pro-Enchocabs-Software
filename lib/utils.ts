export type ClassValue = string | number | null | undefined | ClassValue[] | { [key: string]: boolean | string | number | null | undefined };

function flatten(input: ClassValue): (string | number)[] {
  if (Array.isArray(input)) return input.flatMap(flatten);
  if (input && typeof input === "object") {
    return Object.entries(input)
      .filter(([, v]) => Boolean(v))
      .map(([k]) => k);
  }
  return input ? [input] : [];
}

export function cn(...inputs: ClassValue[]): string {
  return inputs.flatMap(flatten).join(" ").trim();
}
