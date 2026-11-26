# Lessons learned

Real problems hit while building this, how they were found, and the fix. Each one is a good
"tell me about a bug you debugged" story.

## Ratings in the wrong column

**Symptom:** on some episodes the parser read a person's order ("* 1/3 Lb Burger...") as
their rating, and their rating landed in an extra column.

**Cause:** the wiki table used `rowspan="2"` for an order Nick and Mitch shared. The first
row then has four cells and the second has two, so mapping cells to column headers shifts.

**Fix:** stop trusting column positions. The person is the first cell, the rating is
whichever cell reads like "N forks", and anything with bullets is the order. The real page
is now a test fixture (`als-beef.wiki`).

**Takeaway:** with hand-edited data, match by shape, not position, and keep the raw text.

## 125 main episodes with no ratings

**Symptom:** the first full import found ratings on only 441 of 566 main episodes.

**Cause:** listing the misses showed patterns: ice cream episodes have a "Little Pink Spoon
rating" section in spoons, some have "Fork and Dinner Plate rating" with two scores per
cell, and tournaments and specials have no ratings table at all.

**Fix:** accept any section with "rating" in its title, recognize spoons, and take the
first score in a multi-score cell. The remaining misses are genuinely unrated specials.

**Takeaway:** run the parser on the whole dataset early and look at the failures in bulk;
unit tests only cover the cases you already know about.

## Chains with a blank average

**Symptom:** the leaderboard showed some chains with no score, sorted at random.

**Cause:** episode scores come from the wiki's Restaurants list, which goes above 5 (bonus
scores). The chain average reused a helper that drops "joke" scores outside 0-5, so a chain
whose only score was 5.33 averaged nothing.

**Fix:** a plain mean for chains; the 0-5 filter only applies to individual ratings.

**Takeaway:** a helper with a hidden filter is a trap when it's reused for a different job.

## `import.meta` in a Lambda bundle

**Symptom:** a warning in the CDK tests' bundling output: `"import.meta" is not available
with the "cjs" output format`.

**Cause:** the API's config built a file path with `new URL('../data/...', import.meta.url)`.
CDK bundles Lambdas to CommonJS, where `import.meta.url` is empty, so `new URL` would have
thrown at startup and every request would have failed.

**Fix:** resolve the local-only path from `process.cwd()`, lazily. Checked by bundling both
Lambdas with esbuild and invoking them locally.

**Takeaway:** read bundler warnings; this one was a production outage waiting to happen.

## `ENOSPC` in AWS CloudShell

**Symptom:** `npm ci` in CloudShell failed with `npm error code ENOSPC` ("no space left on
device") partway through the first deploy step.

**Cause:** CloudShell's home folder is a persistent 1 GB volume. A full install of this
monorepo (Vite, CDK, test tools) plus npm's cache in `~/.npm` doesn't fit.

**Fix:** clone and install in `/tmp`, which is much larger but wiped when the session ends,
and point npm's cache there too (`npm ci --cache /tmp/npm-cache`). Fine for one-off deploy
commands; anything to keep belongs in git.

**Takeaway:** "free disk" on a cloud shell isn't one number. Know which volume persists and
how big it is.
