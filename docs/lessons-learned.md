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

## A missing colon that failed a deploy

**Symptom:** the deploy after setting the `ALLOWED_ORIGINS` GitHub variable failed with
`Invalid format for origin https//www.doughboysapp.com` from API Gateway. CloudFormation
rolled back, so the live API kept working.

**Cause:** a typo in the variable (`https//` instead of `https://`), typed on a phone. Nothing
checked the value before it reached AWS, so the failure came halfway through a deploy.

**Fix:** `assertOrigins` in `infra/lib/config.ts` checks every origin when the CDK app starts
and fails with a message saying exactly which value is wrong and what shape it needs.

**Takeaway:** validate configuration at the edge, as early as possible, especially values a
human types into a settings page.

## The one chain Claude "skipped"

**Symptom:** after the first classification run, 392 of 393 chains had a category. Sweetfin
Poké had none, and the import reported no error.

**Cause:** the wiki writes that name with a non-breaking space (U+00A0). Claude's answer
used a normal space, and the classifier drops any name it didn't ask about (a guard against
made-up entries), so the answer was discarded silently.

**Fix:** collapse all whitespace in restaurant names when parsing the wiki, so stored names
are plain text. The next import sees "Sweetfin Poké" as a new chain and classifies it.

**Takeaway:** a strict equality check across a system boundary needs both sides
normalized, and "silently dropped" deserves a log line.

## "Which Wich?" had no page

**Symptom:** after chain pages shipped, every chain page loaded on the live site except
"Which Wich?", which said "Chain not found". The tests, including one for that exact name,
passed.

**Cause:** the page's URL held the chain's name, encoded: `/api/chains/Which%20Wich%3F`.
Express decodes `%3F` correctly, so tests passed. But in AWS, API Gateway decodes the path
before handing it to Lambda, so Express saw `/api/chains/Which Wich?`, read the `?` as the
start of a query string, and looked up "Which Wich".

**Fix:** chains now have URL-safe slugs (`which-wich`, `a-and-w-canada`). As a bonus, the
slug merges spelling variants on the wiki: "Papa Johns" and "Papa John's" were two
leaderboard rows and are now one chain with four visits.

**Takeaway:** keep user-facing text out of URL paths, and test against the real gateway:
local tests can't see what the proxy in front of the app does to a request.

## The import that wasn't allowed to read

**Symptom:** the first import after adding the podcast feed failed in AWS with
`AccessDeniedException ... not authorized to perform: dynamodb:Scan`. Nothing was saved,
though every test passed.

**Cause:** the import Lambda had only `grantWriteData` on the episodes table: it used to only
write. The new clean-up step (removing feed-only episodes the wiki now covers) lists the
table first, which is a read. Tests use the in-memory store, which has no permissions, and
the CDK tests only checked the API's role. Worse, the clean-up ran before saving, so its
failure blocked all new data.

**Fix:** `grantReadWriteData` for the import, a CDK test that asserts the import role can
Scan, BatchWrite and Delete, and the clean-up now runs after saving and only logs a failure.

**Takeaway:** when a job gains a new kind of database call, check its IAM grant too: fakes
can't catch permissions. And order steps so optional work can't block essential work.

## The passkey domain that didn't exist yet

**Symptom:** the first deploy with fan accounts failed creating the Cognito user pool:
`RelyingPartyId cannot be reserved domain other than User Pool's prefix domain`. CloudFormation
rolled back; the site was unaffected.

**Cause:** to allow passkeys, I set the pool's passkey relying party ID to its Cognito domain
(`doughboys-app-….auth.us-east-1.amazoncognito.com`). But that domain is created after the
pool, so when the pool was created it named an `amazoncognito.com` domain the pool didn't
own yet, which Cognito rejects. CDK synthesis and the template tests can't know that.

**Fix:** leave `passkeyRelyingPartyId` unset. With only a prefix domain, Cognito uses that
domain for passkeys by default. The setting is only needed with a custom domain.

**Side effect:** the new tables are `RETAIN` (user data), so the rollback skipped deleting
them: "DELETE_SKIPPED" in the log. Empty leftovers are harmless (the next deploy creates
new ones with new names) and can be deleted by hand.

**Takeaway:** a template that synthesizes isn't a template that deploys. For resources
with ordering rules between them, read the service's docs on defaults before setting
something explicitly.
