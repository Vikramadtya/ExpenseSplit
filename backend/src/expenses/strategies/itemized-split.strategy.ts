import { BadRequestException, Injectable } from '@nestjs/common';
import { Money } from '../../common/money/money';
import { OwedAmount, SplitInput, SplitStrategy } from './split.strategy';
import { allocateByWeight } from './weighted';

/**
 * A receipt split line by line. Each item is shared equally between its assignees; tax and tip
 * are then shared in proportion to what each person's items came to.
 */
@Injectable()
export class ItemizedSplitStrategy implements SplitStrategy {
  readonly type = 'ITEMIZED' as const;

  allocate(total: Money, { items, tax = 0, tip = 0 }: SplitInput): OwedAmount[] {
    if (!items?.length)
      throw new BadRequestException('Items must be provided for an itemized split');
    const currency = total.currency;

    const subtotals = new Map<string, Money>();
    let itemsTotal = Money.zero(currency);
    for (const item of items) {
      if (item.assignees.length === 0) {
        throw new BadRequestException(`"${item.name}" is not assigned to anyone`);
      }
      if (new Set(item.assignees).size !== item.assignees.length) {
        throw new BadRequestException(`"${item.name}" lists someone twice`);
      }
      const amount = Money.fromMajor(item.amount, currency);
      itemsTotal = itemsTotal.add(amount);
      const parts = amount.allocate(item.assignees.map(() => 1));
      item.assignees.forEach((userId, i) => {
        subtotals.set(userId, (subtotals.get(userId) ?? Money.zero(currency)).add(parts[i]));
      });
    }

    const extras = Money.fromMajor(tax, currency).add(Money.fromMajor(tip, currency));
    const sum = itemsTotal.add(extras);
    if (!sum.equals(total)) {
      throw new BadRequestException(
        `Items, tax and tip add up to ${sum.toDecimal()}, expected ${total.toDecimal()}`,
      );
    }

    const people = [...subtotals.entries()];
    if (extras.isZero()) return people.map(([userId, owed]) => ({ userId, owed }));

    // Everyone's items weigh in; someone whose items were all free would carry none of the extras.
    const shares = allocateByWeight(
      extras,
      people.map(([userId, subtotal]) => ({ userId, weight: subtotal.minor })),
    );
    return people.map(([userId, subtotal], i) => ({ userId, owed: subtotal.add(shares[i].owed) }));
  }
}
