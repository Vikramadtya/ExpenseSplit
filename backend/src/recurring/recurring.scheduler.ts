import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RecurringService } from './recurring.service';

const TICK_MS = 60_000;

/** Creates due recurring expenses once a minute. Set DISABLE_SCHEDULERS=true to turn it off. */
@Injectable()
export class RecurringScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RecurringScheduler.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly recurring: RecurringService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (this.config.get('DISABLE_SCHEDULERS') === 'true') return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return; // never overlap with a slow previous run
    this.running = true;
    try {
      const created = await this.recurring.runDue();
      if (created > 0) this.logger.log(`Created ${created} recurring expense(s)`);
    } catch (err) {
      this.logger.error(`Recurring run failed: ${err}`);
    } finally {
      this.running = false;
    }
  }
}
