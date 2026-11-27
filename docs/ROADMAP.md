# Roadmap

Ideas we've agreed to build later, with enough notes to pick them up cold. When one starts,
write an ADR for the decisions it needs.

## Community ratings (built: ADRs 0009, 0010)

Follow-ups:

- **Reporting and moderation:** a "report" button and an admin view, if abuse appears.
  Until then, see "Moderating reviews" in docs/DEPLOYMENT.md.
- **Google / Apple sign-in** as Cognito identity providers.
- Audience scores per episode, and sorting the leaderboard by fans' score.

## Logging what you ordered (menus) (first version built: suggestions from orders)

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
