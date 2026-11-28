# Roadmap

Ideas we've agreed to build later, with enough notes to pick them up cold. When one starts,
write an ADR for the decisions it needs.

## Community ratings (built: ADRs 0009, 0010)

Follow-ups:

- **Reporting** is built (ADR 0014). Next: an admin view in the app to restore or delete
  reported reviews, instead of CloudShell commands.
- **Google / Apple sign-in** as Cognito identity providers.
- Audience scores per episode, and sorting the leaderboard by fans' score.

## Logging visits (with what you ordered)

A first version let fans pick what they ordered from a menu built from episode orders; it
was removed (ADR 0011) because a fan rates a chain once, not a visit. If fans want a visit
log (each trip with its date, order and score), the episode data still gives a menu of real
items for big chains (`ratings[].ordered`), and paid food-data APIs (Nutritionix,
Spoonacular) cover large US chains.

## Smaller ideas

- Show the wiki's "Golden Plate Club" and "Platinum Plate Club" badges on chains.
- A "near me" map of reviewed chains.
- A checklist of every reviewed chain you've eaten at.
