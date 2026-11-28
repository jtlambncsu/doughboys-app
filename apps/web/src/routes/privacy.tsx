import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/privacy')({ component: Privacy });

/** Plain-language privacy note. Keep it in step with what the API actually stores. */
function Privacy() {
  return (
    <article className="max-w-prose space-y-4 text-sm leading-relaxed">
      <h1 className="font-heading text-2xl font-semibold">Privacy</h1>
      <p>
        Doughboys App is an unofficial fan project. Browsing needs no account and we don’t use
        tracking or advertising cookies.
      </p>
      <h2 className="font-heading text-lg font-semibold">If you sign up to rate chains</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>Your email and password or passkey</strong> are handled by Amazon Cognito, our
          sign-in service. The app itself never sees your password, and never shows your email to
          anyone.
        </li>
        <li>
          <strong>What’s public:</strong> your display name, and your ratings, reviews and
          locations.
        </li>
        <li>
          <strong>What we store:</strong> those, plus an anonymous account ID that links them to
          you, and any reports you make about reviews. Nothing else.
        </li>
        <li>
          <strong>Your sign-in</strong> is kept in this browser so you stay signed in. Signing out
          removes it.
        </li>
      </ul>
      <h2 className="font-heading text-lg font-semibold">Reports</h2>
      <p>
        Signed-in fans can report reviews. Reports are private: the reviewer never sees who reported
        them. Reviews reported by three fans are hidden until we look at them.
      </p>
      <h2 className="font-heading text-lg font-semibold">Deleting your data</h2>
      <p>
        On your account page, “Delete my account” permanently removes your account, display name,
        ratings, reviews and the reports you made. Backups that allow recovery from mistakes expire
        within 35 days.
      </p>
    </article>
  );
}
