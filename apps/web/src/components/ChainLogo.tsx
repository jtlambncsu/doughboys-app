import { useState } from 'react';
import { LOGO_TOKEN, logoUrl } from '@/lib/logos';
import { cn } from '@/lib/utils';

/** The same chain always gets the same color. */
function hueFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 360;
}

function initials(name: string) {
  const words = name
    .replace(/[^\p{L}\p{N}\s&]/gu, '')
    .split(/\s+/)
    .filter(Boolean);
  return (
    words.length > 1 ? words[0]![0]! + words[1]![0]! : (words[0] ?? '?').slice(0, 2)
  ).toUpperCase();
}

/**
 * The chain's logo from Logo.dev when we know its website, otherwise (or if the image fails)
 * a colored badge with its initials.
 */
export function ChainLogo({
  name,
  domain,
  size = 40,
  className,
}: {
  name: string;
  domain?: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const box = cn('shrink-0 overflow-hidden rounded-xl', className);

  if (LOGO_TOKEN && domain && !failed) {
    const src = logoUrl(domain, size);
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn(box, 'bg-white object-contain')}
        style={{ width: size, height: size }}
      />
    );
  }

  const hue = hueFor(name);
  return (
    <span
      aria-hidden
      className={cn(box, 'flex items-center justify-center font-semibold text-white')}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, hsl(${hue} 65% 52%), hsl(${(hue + 40) % 360} 70% 40%))`,
      }}
    >
      {initials(name)}
    </span>
  );
}
