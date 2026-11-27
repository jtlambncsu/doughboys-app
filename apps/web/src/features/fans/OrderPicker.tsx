import { useId, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { MenuItem } from '@doughboys-app/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { normalize } from '@/lib/search';

const SUGGESTIONS = 8;

/**
 * "What did you order?": search the chain's menu (built from what the Doughboys and other
 * fans ordered) or add your own item.
 */
export function OrderPicker({
  menu,
  value,
  onChange,
  max = 12,
}: {
  menu: MenuItem[];
  value: string[];
  onChange: (items: string[]) => void;
  max?: number;
}) {
  const [query, setQuery] = useState('');
  const inputId = useId();
  const chosen = new Set(value.map(normalize));
  const typed = query.trim();
  const matches = menu
    .filter(
      (item) =>
        !chosen.has(normalize(item.name)) && normalize(item.name).includes(normalize(typed)),
    )
    .slice(0, SUGGESTIONS);
  const canAddTyped =
    typed.length > 0 &&
    !chosen.has(normalize(typed)) &&
    !matches.some((m) => normalize(m.name) === normalize(typed));
  const full = value.length >= max;

  const add = (item: string) => {
    if (full) return;
    onChange([...value, item.trim().slice(0, 60)]);
    setQuery('');
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul aria-label="Your order" className="flex flex-wrap gap-1.5">
          {value.map((item) => (
            <li key={item}>
              <Badge variant="secondary" className="gap-1 py-1 pr-1">
                {item}
                <button
                  type="button"
                  aria-label={`Remove ${item}`}
                  className="hover:bg-background/60 rounded-full p-0.5"
                  onClick={() => onChange(value.filter((v) => v !== item))}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <Input
        id={inputId}
        aria-label="Search the menu"
        placeholder={full ? `Up to ${max} items` : 'Search the menu or type an item'}
        value={query}
        disabled={full}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault(); // don't submit the form
            if (canAddTyped) add(typed);
            else if (matches[0]) add(matches[0].name);
          }
        }}
      />
      {!full && (matches.length > 0 || canAddTyped) && (
        <div aria-label="Menu suggestions" role="group" className="flex flex-wrap gap-1.5">
          {matches.map((item) => (
            <Button
              key={item.name}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => add(item.name)}
            >
              {item.name}
            </Button>
          ))}
          {canAddTyped && (
            <Button type="button" variant="outline" size="sm" onClick={() => add(typed)}>
              <Plus className="size-3.5" aria-hidden /> Add “{typed}”
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
