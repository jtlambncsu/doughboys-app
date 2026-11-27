import { useId } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  ratingInputSchema,
  type FanRating,
  type RatingInput,
  type ValidRating,
} from '@doughboys-app/shared';
import { useDeleteRating, useRate } from '@/api/queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';

/**
 * Rate a chain: forks (0-5 in halves), where, and a short review.
 * Validated with the same Zod schema the API uses, so the rules can't drift apart.
 */
export function RatingForm({
  slug,
  chainName,
  existing,
  onDone,
}: {
  slug: string;
  chainName: string;
  existing?: FanRating;
  onDone: () => void;
}) {
  const rate = useRate(slug);
  const remove = useDeleteRating(slug);
  const ids = { forks: useId(), review: useId(), location: useId() };
  const form = useForm<RatingInput, unknown, ValidRating>({
    resolver: zodResolver(ratingInputSchema),
    defaultValues: {
      forks: existing?.forks ?? 3,
      review: existing?.review ?? '',
      location: existing?.location ?? '',
    },
  });
  const { errors } = form.formState;
  const reviewLength = useWatch({ control: form.control, name: 'review' })?.length ?? 0;

  const submit = form.handleSubmit(async (values) => {
    try {
      await rate.mutateAsync(values);
      toast.success(existing ? 'Rating updated' : `Thanks for rating ${chainName}!`);
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Couldn’t save your rating');
    }
  });

  const deleteRating = async () => {
    try {
      await remove.mutateAsync();
      toast.success('Rating deleted');
      onDone();
    } catch {
      toast.error('Couldn’t delete your rating');
    }
  };

  return (
    <form
      onSubmit={submit}
      aria-label={`Rate ${chainName}`}
      className="bg-card space-y-5 rounded-xl border p-4"
    >
      <Controller
        control={form.control}
        name="forks"
        render={({ field }) => (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <Label id={ids.forks}>Your rating</Label>
              <span className="font-heading text-2xl font-semibold tabular-nums">
                {field.value}{' '}
                <span className="text-muted-foreground text-sm font-normal">forks</span>
              </span>
            </div>
            <Slider
              aria-labelledby={ids.forks}
              min={0}
              max={5}
              step={0.5}
              value={[field.value]}
              onValueChange={([value]) => field.onChange(value)}
            />
          </div>
        )}
      />

      <div className="space-y-2">
        <Label htmlFor={ids.location}>Where? (optional)</Label>
        <Input
          id={ids.location}
          placeholder="City, state"
          autoComplete="off"
          {...form.register('location')}
        />
        {errors.location && <p className="text-destructive text-sm">{errors.location.message}</p>}
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <Label htmlFor={ids.review}>Your review (optional)</Label>
          <span className="text-muted-foreground text-xs tabular-nums">{reviewLength}/500</span>
        </div>
        <Textarea id={ids.review} rows={3} maxLength={500} {...form.register('review')} />
        {errors.review && <p className="text-destructive text-sm">{errors.review.message}</p>}
      </div>

      <p className="text-muted-foreground text-xs">
        Your rating, review and display name are public. Your email never is.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={rate.isPending}>
          {existing ? 'Update rating' : 'Save rating'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        {existing && (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive ml-auto"
            disabled={remove.isPending}
            onClick={() => void deleteRating()}
          >
            Delete my rating
          </Button>
        )}
      </div>
    </form>
  );
}
