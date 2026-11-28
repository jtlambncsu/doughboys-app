# 0014. Reporting reviews: signed-in reports, email to the owner, auto-hide at 3

- **Status:** Accepted
- **Date:** 2026-11-28

## Context

Fan reviews are public user content (ADR 0010). The owner needed a way for fans to flag
abuse, and to hear about it, without building a full admin system.

## Decision

- Each review gets a **random public ID** (not linked to the account) so it can be reported.
  Older ratings get one the first time they're read.
- **Signed-in fans only** can report, with a reason (spam, offensive, off-topic, other) and an
  optional note. A `Reports` table keyed by (review ID, reporter) lets the **database**
  enforce one report per fan per review; reporting your own review is refused.
- Each report **emails the owner** through the alerts SNS topic (ADR 0013), with the review,
  reason and what's needed to moderate. Never the reporter's identity.
- **Three reports from different fans hide the review's text** (and location) until the
  owner moderates it. The fork score still counts. Hiding **sticks through edits**, so it
  can't be dodged by re-saving.
- Moderation is by CloudShell commands for now (docs/DEPLOYMENT.md): restore, or delete.
- Deleting an account deletes the reports that fan made (`byReporter` index).

## Alternatives considered

- **Anonymous reports.** Easier for visitors, but trivially abused to hide reviews.
- **Auto-delete at N reports.** Irreversible on a brigade; hiding is reversible.
- **An admin screen in the app.** Better long-term; needs an admin role and more
  authorization surface. Next step if reports become frequent.
- **A third-party moderation API** (e.g. text classifiers). Overkill at this volume.

## Consequences

- With no `ALERT_EMAIL`, reports are still saved and auto-hide still works, but nobody is
  emailed.
- Three accounts can hide a review; the daily sign-up cap and email verification make that
  costly, and the owner is emailed each time.

## Explaining it in an interview

"Reporting needed to be safe both ways: hard to abuse, and private. Only signed-in fans can
report, the table key makes it one report per person per review, and reports are anonymous.
Three reports hide, not delete, the text, sticky through edits, and every report emails me
through the same SNS topic the alarms use."
