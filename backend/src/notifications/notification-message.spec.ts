import { NOTIFICATION_KINDS, describe as describeKind } from './notification-message';

describe('notification messages', () => {
  it('says who did what in which workspace', () => {
    const m = describeKind('expense.added', {
      byName: 'Bob',
      description: 'Pizza',
      amount: 24,
      currency: 'USD',
      workspaceName: 'Flat',
    });
    expect(m).toEqual({ title: 'Bob added "Pizza"', body: '24.00 USD in Flat' });
  });

  it('has wording for every kind', () => {
    for (const kind of NOTIFICATION_KINDS) {
      expect(describeKind(kind, {}).title).not.toBe('Notification');
    }
  });

  it('falls back safely for unknown kinds', () => {
    expect(describeKind('mystery', {})).toEqual({ title: 'Notification', body: '' });
  });
});
