import { useId, useState } from 'react';
import { Flag } from 'lucide-react';
import { toast } from 'sonner';
import { REPORT_REASONS, type ReportReason } from '@doughboys-app/shared';
import { useReport } from '@/api/queries';
import { useFan } from '@/auth/fan';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';

/**
 * "Report" on someone else's review (ADR 0014). Signed-out visitors are asked to sign in;
 * reports are anonymous to everyone but the owner's moderation tools.
 */
export function ReportDialog({
  slug,
  ratingId,
  reviewer,
}: {
  slug: string;
  ratingId: string;
  reviewer: string;
}) {
  const fan = useFan();
  const report = useReport(slug);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const noteId = useId();

  if (sent) {
    return <span className="text-muted-foreground text-xs">Reported</span>;
  }

  const trigger = (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground h-7 px-2 text-xs"
      aria-label={`Report ${reviewer}’s review`}
      onClick={fan.status === 'signedIn' ? undefined : fan.signIn}
    >
      <Flag className="size-3.5" aria-hidden /> Report
    </Button>
  );
  if (fan.status !== 'signedIn') return trigger;

  const submit = async () => {
    if (!reason) return;
    try {
      await report.mutateAsync({ ratingId, input: { reason, note } });
      toast.success('Thanks. We’ll take a look.');
      setSent(true);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Couldn’t send your report');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setReason('');
          setNote('');
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this review</DialogTitle>
          <DialogDescription>
            What’s wrong with {reviewer}’s review? Reports are anonymous: they won’t see who
            reported them.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup
          aria-label="Reason"
          value={reason}
          onValueChange={(value) => setReason(value as ReportReason)}
        >
          {Object.entries(REPORT_REASONS).map(([value, label]) => (
            <div key={value} className="flex items-center gap-2">
              <RadioGroupItem value={value} id={`${noteId}-${value}`} />
              <Label htmlFor={`${noteId}-${value}`} className="font-normal">
                {label}
              </Label>
            </div>
          ))}
        </RadioGroup>
        <div className="space-y-1.5">
          <Label htmlFor={noteId}>Anything to add? (optional)</Label>
          <Textarea
            id={noteId}
            rows={2}
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!reason || report.isPending} onClick={() => void submit()}>
            Send report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
