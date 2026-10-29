export type NotificationKind =
  | 'expense.added'
  | 'settlement.received'
  | 'comment.added'
  | 'nudge'
  | 'budget.alert'
  | 'recurring.failed';

export const NOTIFICATION_KINDS: NotificationKind[] = [
  'expense.added',
  'settlement.received',
  'comment.added',
  'nudge',
  'budget.alert',
  'recurring.failed',
];

/** Kinds worth an email, not just an in-app/push notification. */
export const EMAIL_KINDS: ReadonlySet<NotificationKind> = new Set(['nudge', 'recurring.failed']);

export interface Message {
  title: string;
  body: string;
}

/** Payloads are stored as JSON, so every value is untrusted: only plain text/numbers are printed. */
const text = (value: unknown, fallback = ''): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;

const money = (amount: unknown, currency: unknown) =>
  `${Number(amount).toFixed(2)} ${text(currency)}`.trim();

/** Turns a stored notification into the words shown to the user. */
export function describe(kind: string, p: Record<string, unknown>): Message {
  const who = text(p.byName, 'Someone');
  const where = text(p.workspaceName, 'your workspace');
  switch (kind) {
    case 'expense.added':
      return {
        title: `${who} added "${text(p.description)}"`,
        body: `${money(p.amount, p.currency)} in ${where}`,
      };
    case 'settlement.received':
      return { title: `${who} paid you`, body: `${money(p.amount, p.currency)} in ${where}` };
    case 'comment.added':
      return {
        title: `${who} commented on "${text(p.description)}"`,
        body: text(p.snippet),
      };
    case 'nudge':
      return {
        title: `${text(p.byName, 'A friend')} sent you a reminder`,
        body: `You owe ${money(p.amount, p.currency)} in ${text(p.workspaceName, 'a workspace')}`,
      };
    case 'budget.alert':
      return {
        title: `Budget ${text(p.percent)}% used`,
        body: `${text(p.label, 'Spending')} in ${where}: ${money(p.spent, p.currency)} of ${money(p.limit, p.currency)}`,
      };
    case 'recurring.failed':
      return {
        title: 'Recurring expense paused',
        body: `"${text(p.description)}" could not be created: ${text(p.reason)}`,
      };
    default:
      return { title: 'Notification', body: '' };
  }
}
