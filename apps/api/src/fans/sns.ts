import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { REPORT_REASONS, tineLabel, type ReportReason } from '@doughboys-app/shared';
import type { ReportNotifier } from './types.js';

/**
 * Emails the owner about a report through the alerts SNS topic (ADR 0014). Includes what's
 * needed to moderate; never the reporter's identity.
 */
export class SnsReportNotifier implements ReportNotifier {
  constructor(
    private readonly topicArn: string,
    private readonly client = new SNSClient({}),
  ) {}

  async notify({
    chain,
    chainName,
    rating,
    reason,
    note,
    reportCount,
    hidden,
  }: Parameters<ReportNotifier['notify']>[0]) {
    const lines = [
      `A review of ${chainName} was reported.`,
      '',
      `Reason: ${REPORT_REASONS[reason as ReportReason] ?? reason}`,
      ...(note ? [`Reporter's note: ${note}`] : []),
      `Reports so far: ${reportCount}${hidden ? ' (the review text is now hidden)' : ''}`,
      '',
      `Review by "${rating.displayName}", ${tineLabel(rating.forks)}:`,
      rating.review ? `"${rating.review}"` : '(no review text)',
      ...(rating.location ? [`Location: ${rating.location}`] : []),
      '',
      'To moderate, see "Moderating reviews" in docs/DEPLOYMENT.md, with:',
      `  chain:  ${chain}`,
      `  userId: ${rating.userId}`,
    ];
    await this.client.send(
      new PublishCommand({
        TopicArn: this.topicArn,
        // Subjects must be ASCII and under 100 characters.
        Subject: `Review reported: ${chainName}`.replace(/[^\x20-\x7e]/g, '').slice(0, 99),
        Message: lines.join('\n'),
      }),
    );
  }
}
