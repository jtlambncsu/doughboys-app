import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { EpisodeDetails, Quote } from '@doughboys-app/shared';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';

/** Text with blank-line paragraph breaks, as the parser stores it. */
export function Paragraphs({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      {text.split('\n\n').map((paragraph, i) => (
        <p key={i} className="mb-3 last:mb-0">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

function QuoteBlock({ quote }: { quote: Quote }) {
  return (
    <figure className="border-primary/60 border-l-2 pl-3">
      <blockquote className="space-y-1">
        {/* Back-and-forth quotes come as one line per speaker. */}
        {quote.text.split('\n').map((line, i) => (
          <p key={i}>“{line.trim()}”</p>
        ))}
      </blockquote>
      {quote.author && (
        <figcaption className="text-muted-foreground mt-1 text-sm">— {quote.author}</figcaption>
      )}
    </figure>
  );
}

const QUOTES_SHOWN = 3;

function Quotes({ quotes }: { quotes: Quote[] }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? quotes : quotes.slice(0, QUOTES_SHOWN);
  return (
    <section aria-labelledby="quotes" className="space-y-3">
      <h2 id="quotes" className="font-heading text-lg font-semibold">
        Quotes
      </h2>
      <div className="space-y-4">
        {shown.map((quote, i) => (
          <QuoteBlock key={i} quote={quote} />
        ))}
      </div>
      {quotes.length > QUOTES_SHOWN && (
        <Button variant="outline" size="sm" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show fewer' : `Show all ${quotes.length} quotes`}
        </Button>
      )}
    </section>
  );
}

/** The segments and extras from the episode's wiki page, below the ratings. */
export function EpisodeExtras({ details }: { details: EpisodeDetails }) {
  return (
    <>
      {details.snackOrWack && (
        <section aria-labelledby="snack-or-wack" className="bg-card rounded-xl border p-4">
          <h2 id="snack-or-wack" className="font-heading mb-2 text-lg font-semibold">
            Snack or Wack
          </h2>
          <Paragraphs text={details.snackOrWack} className="text-sm" />
        </section>
      )}

      {details.quotes.length > 0 && <Quotes quotes={details.quotes} />}

      {details.intro && (
        <Accordion type="single" collapsible className="rounded-xl border px-4">
          <AccordionItem value="intro" className="border-b-0">
            <AccordionTrigger className="font-heading text-base">Nick’s intro</AccordionTrigger>
            <AccordionContent>
              <Paragraphs text={details.intro} className="text-sm leading-relaxed" />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {details.roasts.length > 0 && (
        <section aria-labelledby="roast-spoonman" className="space-y-2">
          <h2 id="roast-spoonman" className="font-heading text-lg font-semibold">
            Roast Spoonman
          </h2>
          <div className="space-y-3">
            {details.roasts.map((roast, i) => (
              <QuoteBlock key={i} quote={roast} />
            ))}
          </div>
        </section>
      )}

      {details.related.length > 0 && (
        <section aria-labelledby="related" className="space-y-2">
          <h2 id="related" className="font-heading text-lg font-semibold">
            Related episodes
          </h2>
          <ul className="divide-y rounded-xl border">
            {details.related.map((slug) => (
              <li key={slug}>
                <Link
                  to="/episodes/$slug"
                  params={{ slug }}
                  className="hover:bg-accent block truncate px-3 py-2 text-sm"
                >
                  {slug}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
