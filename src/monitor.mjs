/** Pure polling reducer. An absent cursor is a baseline, never a new-activity alert. */
export function diffActivity(previous, items, hasNextPage) {
  const hashes = [...new Set(items.map((t) => t.hash).filter(Boolean))];
  if (!hashes.length)
    return { cursor: previous || null, hashes: [], gap: false };
  if (!previous) return { cursor: hashes[0], hashes: [], gap: false };
  const index = hashes.indexOf(previous);
  return {
    cursor: hashes[0],
    hashes: index < 0 ? hashes : hashes.slice(0, index),
    gap: index < 0 && hasNextPage,
  };
}
