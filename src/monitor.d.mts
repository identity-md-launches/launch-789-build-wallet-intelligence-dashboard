export function diffActivity(
  previous: string | null | undefined,
  items: { hash?: string }[],
  hasNextPage: boolean,
): { cursor: string | null; hashes: string[]; gap: boolean };
