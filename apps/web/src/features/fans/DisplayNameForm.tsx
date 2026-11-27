import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { profileInputSchema, type ProfileInput } from '@doughboys-app/shared';
import { useSaveProfile } from '@/api/queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Pick (or change) the public name shown next to your reviews. */
export function DisplayNameForm({
  current,
  onSaved,
  intro,
}: {
  current?: string;
  onSaved?: () => void;
  intro?: string;
}) {
  const save = useSaveProfile();
  const id = useId();
  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileInputSchema),
    defaultValues: { displayName: current ?? '' },
  });
  const error = form.formState.errors.displayName?.message;

  const submit = form.handleSubmit(async ({ displayName }) => {
    try {
      await save.mutateAsync(displayName);
      toast.success('Display name saved');
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn’t save your name');
    }
  });

  return (
    <form onSubmit={submit} aria-label="Display name" className="space-y-2">
      <Label htmlFor={id}>Display name</Label>
      {intro && <p className="text-muted-foreground text-sm">{intro}</p>}
      <div className="flex gap-2">
        <Input
          id={id}
          autoComplete="nickname"
          maxLength={30}
          aria-invalid={Boolean(error)}
          {...form.register('displayName')}
        />
        <Button type="submit" disabled={save.isPending}>
          Save
        </Button>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </form>
  );
}
