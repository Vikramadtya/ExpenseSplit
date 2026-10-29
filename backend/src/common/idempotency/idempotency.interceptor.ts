import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Observable, catchError, from, mergeMap, of, throwError } from 'rxjs';
import { IdempotencyRepository } from './idempotency.repository';

/**
 * With an `Idempotency-Key` header, a write runs at most once per user and key: retries (flaky
 * networks, offline replays) get the stored response instead of creating a duplicate.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly repository: IdempotencyRepository) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const key = req.headers['idempotency-key'];
    if (key === undefined) return next.handle();
    if (typeof key !== 'string' || key.length < 8 || key.length > 100) {
      throw new BadRequestException('Idempotency-Key must be 8-100 characters');
    }

    const userId: string = req.user.id;
    const path: string = req.originalUrl.split('?')[0];

    return from(this.repository.claim(userId, key, path)).pipe(
      mergeMap((won) => (won ? this.run(next, userId, key) : from(this.replay(userId, key, path)))),
    );
  }

  private run(next: CallHandler, userId: string, key: string) {
    return next.handle().pipe(
      mergeMap((body) => from(this.repository.complete(userId, key, body).then(() => body))),
      // A failed attempt must not block a legitimate retry with the same key.
      catchError((err) =>
        from(this.repository.release(userId, key)).pipe(mergeMap(() => throwError(() => err))),
      ),
    );
  }

  private async replay(userId: string, key: string, path: string) {
    const stored = await this.repository.find(userId, key);
    if (!stored) throw new ConflictException('Please retry the request');
    if (stored.path !== path) {
      throw new UnprocessableEntityException(
        'Idempotency-Key was already used for another request',
      );
    }
    if (stored.response === null)
      throw new ConflictException('The original request is still in progress');
    return stored.response;
  }
}
