import {
  createRootRouteWithContext,
  Link,
  Outlet,
  useRouter,
  type ErrorComponentProps,
} from '@tanstack/react-router';
import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import { Utensils } from 'lucide-react';
import { ErrorState } from '@/components/ErrorState';
import { Button } from '@/components/ui/button';
import type { RouterContext } from '@/router';

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  errorComponent: RootError,
  notFoundComponent: NotFound,
});

const navLink =
  'rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-foreground';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-background/90 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-2 gap-y-2 px-4 py-3">
          <Link to="/" className="mr-auto flex items-center gap-2">
            <Utensils className="text-primary size-5 shrink-0" aria-hidden />
            <span className="flex flex-col leading-tight">
              <span className="font-heading text-lg font-semibold whitespace-nowrap">
                Doughboys App
              </span>
              {/* Not the show's official app: say so on every page, right by the name. */}
              <span className="text-muted-foreground text-[11px] font-medium tracking-wide whitespace-nowrap uppercase">
                Unofficial fan app
              </span>
            </span>
          </Link>
          <nav aria-label="Main" className="flex gap-1">
            <Link to="/" className={navLink} activeOptions={{ exact: true }}>
              Leaderboard
            </Link>
            <Link to="/episodes" className={navLink}>
              Episodes
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-5 pb-16">{children}</main>
      <footer className="text-muted-foreground mx-auto max-w-3xl px-4 pb-8 text-center text-xs">
        An unofficial fan project, not affiliated with Doughboys or Headgum. Episode data comes from
        the{' '}
        <a
          className="underline"
          href="https://doughboys.fandom.com"
          target="_blank"
          rel="noreferrer"
        >
          Doughboys Wikia
        </a>{' '}
        under{' '}
        <a
          className="underline"
          href="https://www.fandom.com/licensing"
          target="_blank"
          rel="noreferrer"
        >
          CC BY-SA
        </a>
        .
      </footer>
    </div>
  );
}

function RootLayout() {
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}

/** Shown when a loader or component throws. "Try again" re-runs the failed queries. */
function RootError({ error }: ErrorComponentProps) {
  const router = useRouter();
  const { reset } = useQueryErrorResetBoundary();
  return (
    <Shell>
      <ErrorState
        message={error instanceof Error ? error.message : 'Something went wrong'}
        onRetry={() => {
          reset();
          void router.invalidate();
        }}
      />
    </Shell>
  );
}

function NotFound() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <p className="text-muted-foreground">That page doesn't exist.</p>
      <Button asChild variant="outline">
        <Link to="/">Back to the leaderboard</Link>
      </Button>
    </div>
  );
}
