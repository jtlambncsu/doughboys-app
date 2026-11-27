import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { tineLabel } from '@doughboys-app/shared';
import { meQueryOptions, myRatingsQueryOptions, useDeleteAccount } from '@/api/queries';
import { useFan } from '@/auth/fan';
import { ForkTines } from '@/components/ForkTines';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DisplayNameForm } from '@/features/fans/DisplayNameForm';
import { formatDate } from '@/lib/format';

export const Route = createFileRoute('/me')({ component: MePage });

function MePage() {
  const fan = useFan();
  if (fan.status === 'loading') return <Skeleton className="h-40 w-full" />;
  if (fan.status === 'signedOut') {
    return (
      <section className="space-y-3 py-8 text-center">
        <h1 className="font-heading text-2xl font-semibold">Your ratings</h1>
        <p className="text-muted-foreground">Sign in to rate chains and see your ratings here.</p>
        <Button onClick={fan.signIn}>Sign in</Button>
      </section>
    );
  }
  return <Account />;
}

function Account() {
  const { api } = Route.useRouteContext();
  const fan = useFan();
  const me = useQuery(meQueryOptions(api));
  const mine = useQuery(myRatingsQueryOptions(api));

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Your account</h1>
        {fan.email && (
          <p className="text-muted-foreground text-sm">
            Signed in as {fan.email} (only you can see this)
          </p>
        )}
      </div>

      {me.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <DisplayNameForm
          key={me.data?.displayName ?? 'none'}
          current={me.data?.displayName}
          intro="Shown next to your ratings and reviews."
        />
      )}

      <div className="space-y-2">
        <h2 className="font-heading text-lg font-semibold">Your ratings</h2>
        {mine.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : mine.data && mine.data.length > 0 ? (
          <ul aria-label="Your ratings" className="divide-y rounded-xl border">
            {mine.data.map((rating) => (
              <li key={rating.chain}>
                <Link
                  to="/chains/$slug"
                  params={{ slug: rating.chain }}
                  className="hover:bg-accent flex items-center gap-3 px-3 py-2.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {rating.chainName ?? rating.chain}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatDate(rating.updatedAt.slice(0, 10))}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-0.5">
                    <ForkTines value={rating.forks} size={16} />
                    <span className="text-muted-foreground text-xs">{tineLabel(rating.forks)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            No ratings yet. Find a chain on the{' '}
            <Link to="/" className="underline">
              leaderboard
            </Link>{' '}
            and rate it.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button variant="outline" onClick={fan.signOut}>
          Sign out
        </Button>
        <DeleteAccount />
      </div>
    </section>
  );
}

const CONFIRM_WORD = 'delete';

/** Deletes everything: ratings, profile and the sign-in account. Asks twice, on purpose. */
function DeleteAccount() {
  const fan = useFan();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const deleteAccount = useDeleteAccount();
  const [typed, setTyped] = useState('');

  const confirm = async () => {
    try {
      await deleteAccount.mutateAsync();
      await fan.forget();
      queryClient.removeQueries({ queryKey: ['me'] });
      void queryClient.invalidateQueries({ queryKey: ['ratings'] });
      void queryClient.invalidateQueries({ queryKey: ['chains'] });
      toast.success('Your account and ratings are deleted');
      void navigate({ to: '/' });
    } catch {
      toast.error('Couldn’t delete your account. Please try again.');
    }
  };

  return (
    <AlertDialog onOpenChange={() => setTyped('')}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className="text-destructive">
          Delete my account
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes your account, your display name and all your ratings and
            reviews. It can’t be undone. Type “{CONFIRM_WORD}” to confirm.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          aria-label={`Type ${CONFIRM_WORD} to confirm`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
        />
        <AlertDialogFooter>
          <AlertDialogCancel>Keep my account</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={typed.trim().toLowerCase() !== CONFIRM_WORD || deleteAccount.isPending}
            onClick={(e) => {
              e.preventDefault(); // close only once it's done
              void confirm();
            }}
          >
            Delete everything
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
