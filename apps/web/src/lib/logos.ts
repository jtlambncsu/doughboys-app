/** Public (publishable) Logo.dev token, safe to ship to browsers. Unset: initials only. */
export const LOGO_TOKEN = import.meta.env.VITE_LOGO_DEV_TOKEN as string | undefined;

export const logosEnabled = Boolean(LOGO_TOKEN);

export function logoUrl(domain: string, size: number) {
  return `https://img.logo.dev/${encodeURIComponent(domain)}?token=${LOGO_TOKEN}&size=${size * 2}&format=png&retina=true`;
}
