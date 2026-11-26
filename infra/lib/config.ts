/**
 * Parses a comma-separated list from the first source that has a non-blank value.
 *
 * Blank counts as missing on purpose: GitHub Actions passes an unset repository variable
 * (`${{ vars.X }}`) as an empty string, which `??` would treat as a real value.
 */
export function listSetting(...sources: (string | undefined)[]): string[] | undefined {
  const value = sources.find((source) => source?.trim());
  return value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isOrigin(value: string) {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && url.origin === value;
  } catch {
    return false;
  }
}

/**
 * Checks that each entry is a bare web origin, like `https://doughboysapp.com`, so a typo in
 * a GitHub variable fails here with a clear message instead of halfway through a deploy.
 */
export function assertOrigins(origins: string[] | undefined, name: string) {
  for (const origin of origins ?? []) {
    if (!isOrigin(origin)) {
      throw new Error(
        `${name}: "${origin}" isn't a valid origin. Use the form https://example.com ` +
          '(with "://", and no path or trailing slash).',
      );
    }
  }
  return origins;
}
