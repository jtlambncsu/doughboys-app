# Roadmap

Ideas we've agreed to build later, with enough notes to pick them up cold. When one starts,
write an ADR for the decisions it needs.

## Community ratings: "critic score" and "audience score"

**Idea:** fans rate the same chains the Doughboys reviewed, and each chain shows two numbers
side by side, like Rotten Tomatoes: the boys' fork rating (critic score) and the community's
average (audience score).

**Sketch:**

- **Sign-in:** reuse Puzzle Log's Cognito setup (managed login, OIDC + PKCE, JWT checked at
  API Gateway). Browsing stays public; only rating needs an account (see ADR 0004).
- **Data:** a `Ratings` table keyed by chain, with the user as the sort key (one rating per
  person per chain, editable), holding forks (0-5, half steps), an optional note, the date and
  what they ordered. The audience score is a running average kept on the chain, updated when a
  rating changes, so the leaderboard doesn't scan every rating.
- **UI:** a "Rate it" button on each chain, a forks picker (React Hook Form + Zod), and an
  audience score next to the critic score on the leaderboard and chain pages. Show the score
  only once a chain has a few ratings (e.g. 5), with the count.
- **Abuse:** one rating per account per chain, API Gateway throttling, and a minimum account
  age before ratings count are enough to start.
- **Open questions:** rate a chain, or a specific visit (location, date)? Do episodes get
  their own audience scores?

## Logging what you ordered (menus)

**Idea:** make rating quick by letting people pick what they ordered instead of typing it.

**Findings so far:** there's no free, official menu API for US chains. The options:

- **Build menus from data we already have (recommended start).** Every episode lists what
  each person ordered (`ratings[].ordered`), so about 560 episodes already give a menu of real
  items for the big chains. Offer those as autocomplete suggestions, and add each new item a
  user types, so the menu grows with use, and with what fans actually order.
- **A commercial food-data API** (Nutritionix, Spoonacular and similar have restaurant menu
  items for large US chains). Costs money or has tight free tiers, and coverage stops at big
  chains. Check terms and pricing when we get there.
- **Scraping chain websites:** fragile and usually against their terms. Not planned.

**Sketch:** a `MenuItems` table keyed by chain, with item names, how often each was ordered
and where it came from (`episode` or `community`); the rating form's "What did you order?"
field is a searchable multi-select over it, with "add your own".

## Smaller ideas

- Show the wiki's "Golden Plate Club" and "Platinum Plate Club" badges on chains.
- A "near me" map of reviewed chains.
- A checklist of every reviewed chain you've eaten at.
