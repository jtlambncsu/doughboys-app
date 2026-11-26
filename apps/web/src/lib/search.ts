/** Case- and accent-insensitive, so "chilis" finds "Chili’s" and "rodriguez" finds "Rodríguez". */
export function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'`]/g, '').toLowerCase();
}

/** True when every word of the query appears somewhere in the fields. */
export function matches(query: string, ...fields: (string | undefined)[]) {
  const haystack = normalize(fields.filter(Boolean).join(' '));
  return normalize(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}
