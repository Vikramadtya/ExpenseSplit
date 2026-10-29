import { Injectable, NestMiddleware } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import type { NextFunction, Request, Response } from 'express';
import type { Histogram } from 'prom-client';

export const HTTP_DURATION_METRIC = 'http_request_duration_seconds';

/**
 * Times every request, labelled by the route *template* (/workspaces/:workspaceId/expenses),
 * never the concrete URL, so the number of series stays small. Middleware (not an interceptor)
 * so requests rejected by guards (401/403/404) are counted too.
 */
@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  constructor(@InjectMetric(HTTP_DURATION_METRIC) private readonly duration: Histogram<string>) {}

  use(req: Request, res: Response, next: NextFunction) {
    const stop = this.duration.startTimer();
    // 'finish' fires once the response is fully sent, by which point the route is resolved and
    // errors turned into responses by the exception filter carry their real status code.
    res.once('finish', () => {
      const route: string = req.route?.path ?? 'unmatched';
      // Long-lived streams would swamp the latency numbers; the scrape endpoint measures itself.
      if (route.endsWith('/events') || route === '/metrics') return;
      stop({ method: req.method, route, status: String(res.statusCode) });
    });
    next();
  }
}
