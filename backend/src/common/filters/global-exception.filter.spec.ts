import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

const run = (exception: unknown) => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({
        headers: { 'x-request-id': 'req-1' },
        method: 'GET',
        url: '/api/v1/auth/google/callback?code=SECRET-ONE-TIME-CODE',
        path: '/api/v1/auth/google/callback',
      }),
    }),
  };
  new GlobalExceptionFilter().catch(exception, host as never);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] };
};

// What drizzle throws: a wrapper that repeats the SQL and parameters, around the database's error.
const databaseError = () => {
  const pg = Object.assign(new Error('column "upi_vpa" does not exist'), {
    name: 'PostgresError',
    code: '42703',
    hint: 'Perhaps you meant another column.',
  });
  return new Error(
    'Failed query: select "upi_vpa" from "users" where email = $1\nparams: jane@example.com',
    {
      cause: pg,
    },
  );
};

describe('GlobalExceptionFilter', () => {
  let logged: string[];
  beforeEach(() => {
    logged = [];
    jest.spyOn(Logger.prototype, 'error').mockImplementation((m) => void logged.push(String(m)));
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((m) => void logged.push(String(m)));
  });
  afterEach(() => jest.restoreAllMocks());

  it('tells the client nothing about an internal error', () => {
    const { status, body } = run(databaseError());
    expect(status).toBe(500);
    expect(body.message).toBe('Internal server error');
    expect(body.requestId).toBe('req-1');
    const sent = JSON.stringify(body);
    expect(sent).not.toContain('upi_vpa');
    expect(sent).not.toContain('jane@example.com');
    expect(sent).not.toContain('SECRET-ONE-TIME-CODE');
  });

  it('logs the underlying database error, which the wrapper hides', () => {
    run(databaseError());
    const log = logged.join('\n');
    expect(log).toContain('42703');
    expect(log).toContain('column \\"upi_vpa\\" does not exist');
    expect(log).toContain('Perhaps you meant another column');
  });

  it('keeps personal data and one-time codes out of the log', () => {
    run(databaseError());
    const log = logged.join('\n');
    expect(log).not.toContain('jane@example.com');
    expect(log).not.toContain('SECRET-ONE-TIME-CODE');
  });

  it('still returns specific messages for client errors', () => {
    const { status, body } = run(new HttpException('Workspace not found', HttpStatus.NOT_FOUND));
    expect(status).toBe(404);
    expect(body.message).toBe('Workspace not found');
  });
});
