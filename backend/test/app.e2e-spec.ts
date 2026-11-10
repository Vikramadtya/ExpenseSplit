import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import http from 'node:http';
import { AppModule } from '../src/app.module';
import { DRIZZLE_CLIENT } from '../src/database/database.module';
import type { DrizzleDb } from '../src/database/database.module';
import { fxRates, refreshTokens, users, workspaces } from '../src/database/schema';
import { AuthService } from '../src/auth/auth.service';
import { RecurringService } from '../src/recurring/recurring.service';
import { AccountService } from '../src/account/account.service';
import { OcrProvider } from '../src/receipts/ocr.provider';
import { configureApp } from '../src/app.setup';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FxRateProvider } from '../src/fx/fx.provider';
import { eq } from 'drizzle-orm';

// Runs against a real, migrated Postgres. Skipped unless TEST_DATABASE_URL is set.
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

const fakeOcr = {
  available: true,
  extract: jest.fn(async (bytes: Buffer) => {
    if (bytes.includes(Buffer.from('FAIL'))) throw new Error('unreadable receipt');
    return {
      merchant: 'Joe’s Pizza Restaurant',
      date: '2026-10-01',
      currency: 'usd',
      items: [
        { name: 'Pasta', amount: 20 },
        { name: 'Salad', amount: 10 },
        { name: 'Starter', amount: 10 },
      ],
      tax: 4,
      tip: 6,
      total: 50,
    };
  }),
};

suite('ExpenseSplit API (integration)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let db: DrizzleDb;
  const tag = Date.now();

  const makeUser = async (name: string) => {
    const [u] = await db
      .insert(users)
      .values({ name, email: `${name}-${tag}@test.dev` })
      .returning();
    const token = jwt.sign({ sub: u.id, email: u.email, name: u.name });
    return { id: u.id, auth: { Authorization: `Bearer ${token}` } };
  };
  const api = (method: 'get' | 'post' | 'patch' | 'delete', path: string, as: { auth: object }) =>
    request(app.getHttpServer())
      [method](`/api/v1${path}`)
      .set(as.auth as Record<string, string>);

  let alice: Awaited<ReturnType<typeof makeUser>>;
  let bob: Awaited<ReturnType<typeof makeUser>>;
  let carol: Awaited<ReturnType<typeof makeUser>>;
  let eve: Awaited<ReturnType<typeof makeUser>>;
  let ws: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.JWT_SECRET = 'test-secret';
    process.env.THROTTLE_LIMIT = '100000';
    process.env.DISABLE_SCHEDULERS = 'true'; // tests trigger runs themselves
    process.env.RECEIPTS_DIR = mkdtempSync(join(tmpdir(), 'receipts-'));
    process.env.FRONTEND_URL = 'http://localhost:5173';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      // Never hit the real exchange-rate service from tests.
      .overrideProvider(FxRateProvider)
      .useValue({
        fetchLatest: async (base: string) => ({
          date: '2026-10-29',
          rates:
            base === 'INR'
              ? { USD: 0.0125 }
              : base === 'JPY'
                ? { USD: 0.0067 }
                : { EUR: 0.5, INR: 80, JPY: 150 },
        }),
      })
      // A scripted scanner: the second receipt in a test run fails, to cover that path.
      .overrideProvider(OcrProvider)
      .useValue(fakeOcr)
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app as NestExpressApplication);
    await app.init();
    jwt = moduleRef.get(JwtService);
    db = moduleRef.get(DRIZZLE_CLIENT);

    [alice, bob, carol, eve] = await Promise.all(['alice', 'bob', 'carol', 'eve'].map(makeUser));

    const created = await api('post', '/workspaces', alice).send({
      name: 'Trip',
      defaultCurrency: 'USD',
    });
    ws = created.body.id;
    for (const u of ['bob', 'carol']) {
      await api('post', `/workspaces/${ws}/members`, alice).send({ email: `${u}-${tag}@test.dev` });
    }
  });

  afterAll(() => app.close());

  it('rejects unauthenticated requests on every route group', async () => {
    for (const path of ['/workspaces', `/workspaces/${ws}/analytics`, '/balances']) {
      await request(app.getHttpServer()).get(`/api/v1${path}`).expect(401);
    }
  });

  it('hides a workspace from non-members on every workspace route', async () => {
    const routes: Array<['get' | 'post' | 'patch' | 'delete', string]> = [
      ['get', `/workspaces/${ws}`],
      ['get', `/workspaces/${ws}/members`],
      ['get', `/workspaces/${ws}/expenses`],
      ['get', `/workspaces/${ws}/balances`],
      ['get', `/workspaces/${ws}/balances/debts`],
      ['get', `/workspaces/${ws}/settlements`],
      ['get', `/workspaces/${ws}/analytics`],
      ['get', `/workspaces/${ws}/activity`],
      ['patch', `/workspaces/${ws}`],
      ['delete', `/workspaces/${ws}`],
    ];
    for (const [method, path] of routes) {
      await api(method, path, eve).expect(404);
    }
  });

  it('only lets admins change a workspace', async () => {
    await api('patch', `/workspaces/${ws}`, bob).send({ name: 'Hijack' }).expect(403);
    await api('post', `/workspaces/${ws}/members`, bob).send({ email: 'x@y.z' }).expect(403);
  });

  it('only shows user profiles to people who share a workspace', async () => {
    await api('get', `/users/${bob.id}`, alice).expect(200);
    await api('get', `/users/${alice.id}`, eve).expect(404);
  });

  it('validates expense payloads', async () => {
    await api('post', `/workspaces/${ws}/expenses`, alice).send({ description: 'x' }).expect(400);
    await api('post', `/workspaces/${ws}/expenses`, alice)
      .send({
        description: 'Dinner',
        amount: 30,
        date: new Date().toISOString(),
        payers: [{ userId: alice.id, amount: 20 }],
      })
      .expect(400); // payers don't add up to the total
    await api('post', `/workspaces/${ws}/expenses`, alice)
      .send({
        description: 'Dinner',
        amount: 30,
        date: new Date().toISOString(),
        payers: [{ userId: alice.id, amount: 30 }],
        participants: [alice.id, eve.id],
      })
      .expect(400); // eve is not a member
  });

  let dinnerId: string;

  it('splits an expense to the cent and derives balances', async () => {
    const res = await api('post', `/workspaces/${ws}/expenses`, alice)
      .send({
        description: 'Dinner',
        amount: 100,
        date: new Date().toISOString(),
        payers: [{ userId: alice.id, amount: 100 }],
        participants: [alice.id, bob.id, carol.id],
      })
      .expect(201);
    dinnerId = res.body.id;
    const owed = res.body.splits.map((s: { amountOwed: string }) => Number(s.amountOwed) * 100);
    expect(owed.reduce((a: number, b: number) => a + b, 0)).toBe(10000);

    const balances = await api('get', `/workspaces/${ws}/balances`, alice).expect(200);
    const usd = balances.body.byCurrency[0];
    expect(usd.owedToYou).toBeCloseTo(66.66, 2);

    const debts = await api('get', `/workspaces/${ws}/balances/debts`, alice).expect(200);
    expect(debts.body).toHaveLength(2);
    expect(debts.body.every((d: { creditor: string }) => d.creditor === alice.id)).toBe(true);
  });

  it('recomputes splits when an expense amount changes', async () => {
    const res = await api('patch', `/expenses/${dinnerId}`, alice).send({ amount: 90 }).expect(200);
    expect(res.body.version).toBe(2);
    expect(res.body.splits.map((s: { amountOwed: string }) => Number(s.amountOwed))).toEqual([
      30, 30, 30,
    ]);
    // A stale version is rejected.
    await api('patch', `/expenses/${dinnerId}`, alice)
      .send({ description: 'Dinner!', expectedVersion: 1 })
      .expect(409);
  });

  it('applies a settlement in the right direction', async () => {
    await api('post', `/workspaces/${ws}/settlements`, bob)
      .send({ payerId: bob.id, payeeId: alice.id, amount: 30, date: new Date().toISOString() })
      .expect(201);
    const debts = await api('get', `/workspaces/${ws}/balances/debts`, alice).expect(200);
    expect(debts.body).toEqual([
      expect.objectContaining({
        debtor: carol.id,
        creditor: alice.id,
        amount: 30,
        currency: 'USD',
      }),
    ]);

    const raw = await api('get', `/workspaces/${ws}/balances/debts?simplified=false`, alice).expect(
      200,
    );
    expect(raw.body).toEqual(debts.body);
  });

  it('rejects settlements involving non-members', async () => {
    await api('post', `/workspaces/${ws}/settlements`, alice)
      .send({ payerId: eve.id, payeeId: alice.id, amount: 5, date: new Date().toISOString() })
      .expect(400);
  });

  it('paginates and searches expenses', async () => {
    for (const n of [1, 2, 3]) {
      await api('post', `/workspaces/${ws}/expenses`, bob)
        .send({
          description: `Coffee ${n}`,
          amount: 3,
          date: new Date(Date.now() + n * 1000).toISOString(),
          tags: ['drinks'],
          payers: [{ userId: bob.id, amount: 3 }],
          participants: [bob.id],
        })
        .expect(201);
    }
    const first = await api('get', `/workspaces/${ws}/expenses?limit=2&tags=drinks`, alice).expect(
      200,
    );
    expect(first.body).toHaveLength(2);
    const cursor = first.headers['x-next-cursor'];
    expect(cursor).toBeTruthy();

    const second = await api(
      'get',
      `/workspaces/${ws}/expenses?limit=2&tags=drinks&cursor=${cursor}`,
      alice,
    ).expect(200);
    expect(second.body).toHaveLength(1);
    expect(second.headers['x-next-cursor']).toBeUndefined();

    const search = await api('get', `/workspaces/${ws}/expenses?q=dinn`, alice).expect(200);
    expect(search.body.map((e: { description: string }) => e.description)).toEqual(['Dinner']);
  });

  it('refuses to remove a member who still has a balance', async () => {
    await api('delete', `/workspaces/${ws}/members/${carol.id}`, alice).expect(400);
  });

  describe('sessions', () => {
    const profile = () => ({
      emails: [{ value: `session-${tag}@test.dev` }],
      name: { givenName: 'Sam', familyName: 'Session' },
      photos: [],
    });
    const refresh = (refreshToken: string) =>
      request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken });

    it('issues short-lived access tokens that work', async () => {
      const { accessToken } = await app.get(AuthService).validateOAuthLogin(profile());
      const { exp, iat } = jwt.decode(accessToken);
      expect(exp - iat).toBe(15 * 60);
      await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('rotates refresh tokens, and each works only once', async () => {
      const first = await app.get(AuthService).validateOAuthLogin(profile());
      const second = await refresh(first.refreshToken).expect(200);
      expect(second.body.refreshToken).not.toBe(first.refreshToken);
      await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${second.body.accessToken}`)
        .expect(200);
      await refresh(first.refreshToken).expect(401);
    });

    it('revokes the whole chain when an old token is replayed later', async () => {
      const first = await app.get(AuthService).validateOAuthLogin(profile());
      const second = await refresh(first.refreshToken).expect(200);
      // Pretend the rotation happened a minute ago, so the replay isn't a racing tab.
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date(Date.now() - 60_000) })
        .where(eq(refreshTokens.revokedAt, refreshTokens.revokedAt));
      await refresh(first.refreshToken).expect(401);
      await refresh(second.body.refreshToken).expect(401);
    });

    it('does not punish a racing tab inside the grace window', async () => {
      const first = await app.get(AuthService).validateOAuthLogin(profile());
      const second = await refresh(first.refreshToken).expect(200);
      await refresh(first.refreshToken).expect(401);
      await refresh(second.body.refreshToken).expect(200);
    });

    it('logout revokes the session', async () => {
      const { refreshToken } = await app.get(AuthService).validateOAuthLogin(profile());
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken })
        .expect(204);
      await refresh(refreshToken).expect(401);
    });

    it('rejects garbage', async () => {
      await refresh('nope').expect(401);
      await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({}).expect(400);
    });
  });

  describe('collaboration', () => {
    let flat: string;
    let rent: string;
    const today = () => new Date().toISOString();

    beforeAll(async () => {
      flat = (await api('post', '/workspaces', alice).send({ name: 'Flat' })).body.id;
      await api('post', `/workspaces/${flat}/members`, alice).send({
        email: `bob-${tag}@test.dev`,
      });
      const res = await api('post', `/workspaces/${flat}/expenses`, alice)
        .send({
          description: 'Rent',
          amount: 200,
          date: today(),
          payers: [{ userId: alice.id, amount: 200 }],
          participants: [alice.id, bob.id],
        })
        .expect(201);
      rent = res.body.id;
    });

    const bobOwes = async () =>
      (await api('get', `/workspaces/${flat}/balances/debts`, alice)).body as Array<{
        amount: number;
      }>;

    it('limits editing and deleting to the creator or an admin', async () => {
      const bobsExpense = (
        await api('post', `/workspaces/${flat}/expenses`, bob).send({
          description: 'Snacks',
          amount: 10,
          date: today(),
          payers: [{ userId: bob.id, amount: 10 }],
          participants: [bob.id],
        })
      ).body.id;
      // Bob can't touch Alice's expense...
      await api('patch', `/expenses/${rent}`, bob).send({ description: 'x' }).expect(403);
      await api('delete', `/expenses/${rent}`, bob).expect(403);
      // ...but Alice (admin) can change Bob's, and Bob can change his own.
      await api('patch', `/expenses/${bobsExpense}`, alice)
        .send({ description: 'Snacks!' })
        .expect(200);
      await api('patch', `/expenses/${bobsExpense}`, bob)
        .send({ description: 'Snacks?' })
        .expect(200);
    });

    it('deletes softly, drops the expense from balances, and restores it', async () => {
      expect(await bobOwes()).toEqual([expect.objectContaining({ amount: 100 })]);

      await api('delete', `/expenses/${rent}`, alice).expect(204);
      await api('get', `/expenses/${rent}`, alice).expect(404);
      expect(await bobOwes()).toEqual([]);
      const list = await api('get', `/workspaces/${flat}/expenses`, alice).expect(200);
      expect(list.body.map((e: { id: string }) => e.id)).not.toContain(rent);

      await api('post', `/expenses/${rent}/restore`, bob).expect(403);
      await api('post', `/expenses/${rent}/restore`, alice).expect(200);
      expect(await bobOwes()).toEqual([expect.objectContaining({ amount: 100 })]);
    });

    it('lets members comment, and only authors or admins delete comments', async () => {
      const mine = await api('post', `/expenses/${rent}/comments`, bob)
        .send({ body: 'Paid you back?' })
        .expect(201);
      await api('post', `/expenses/${rent}/comments`, bob).send({ body: '   ' }).expect(400);
      await api('post', `/expenses/${rent}/comments`, eve).send({ body: 'hi' }).expect(404);

      const list = await api('get', `/expenses/${rent}/comments`, alice).expect(200);
      expect(list.body).toEqual([
        expect.objectContaining({
          body: 'Paid you back?',
          user: expect.objectContaining({ name: 'bob' }),
        }),
      ]);
      await api('get', `/expenses/${rent}/comments`, eve).expect(404);

      const alices = await api('post', `/expenses/${rent}/comments`, alice)
        .send({ body: 'Yes' })
        .expect(201);
      await api('delete', `/comments/${alices.body.id}`, bob).expect(403);
      await api('delete', `/comments/${mine.body.id}`, alice).expect(204); // admin may remove it
      await api('delete', `/comments/${alices.body.id}`, alice).expect(204);
    });

    it('invites people with a revocable link', async () => {
      await api('post', `/workspaces/${flat}/invites`, bob).expect(403);
      const { body } = await api('post', `/workspaces/${flat}/invites`, alice).expect(201);

      const preview = await api('get', `/invites/${body.token}`, eve).expect(200);
      expect(preview.body).toEqual({
        workspaceName: 'Flat',
        memberCount: 2,
        invitedBy: 'alice',
        alreadyMember: false,
      });
      await api('post', `/invites/${body.token}/accept`, eve).expect(200);
      await api('post', `/invites/${body.token}/accept`, eve).expect(200); // idempotent
      await api('get', `/workspaces/${flat}/members`, eve).expect(200);
      expect((await api('get', `/workspaces/${flat}/members`, alice)).body).toHaveLength(3);

      await api('delete', `/workspaces/${flat}/invites`, alice).expect(204);
      await api('get', `/invites/${body.token}`, carol).expect(404);
      await api('get', '/invites/not-a-real-token', carol).expect(404);
    });

    it('promotes members and keeps at least one admin', async () => {
      await api('patch', `/workspaces/${flat}/members/${bob.id}`, bob)
        .send({ role: 'ADMIN' })
        .expect(403);
      await api('patch', `/workspaces/${flat}/members/${alice.id}`, alice)
        .send({ role: 'MEMBER' })
        .expect(400);
      await api('patch', `/workspaces/${flat}/members/${eve.id}`, alice)
        .send({ role: 'ADMIN' })
        .expect(200);
      await api('patch', `/workspaces/${flat}/members/${alice.id}`, eve)
        .send({ role: 'MEMBER' })
        .expect(200);
      await api('patch', `/workspaces/${flat}/members/${alice.id}`, eve)
        .send({ role: 'ADMIN' })
        .expect(200);
    });

    it('lets settled members leave, but not those with a balance', async () => {
      await api('post', `/workspaces/${flat}/leave`, bob).expect(400); // still owes Alice
      await api('post', `/workspaces/${flat}/leave`, eve).expect(204);
      await api('get', `/workspaces/${flat}`, eve).expect(404);
    });

    it('does not let the only admin abandon a group that has other members', async () => {
      const solo = (await api('post', '/workspaces', alice).send({ name: 'Solo' })).body.id;
      await api('post', `/workspaces/${solo}/members`, alice).send({
        email: `bob-${tag}@test.dev`,
      });
      await api('post', `/workspaces/${solo}/leave`, alice).expect(400);
    });

    it('gives each pair of friends one private ledger', async () => {
      const first = await api('post', `/friends/${bob.id}/workspace`, alice).expect(200);
      const again = await api('post', `/friends/${alice.id}/workspace`, bob).expect(200);
      expect(first.body.id).toBe(again.body.id);
      expect(first.body.type).toBe('DIRECT');

      const direct = first.body.id;
      await api('post', `/workspaces/${direct}/members`, alice)
        .send({ email: `carol-${tag}@test.dev` })
        .expect(400);
      await api('post', `/workspaces/${direct}/invites`, alice).expect(400);
      await api('post', `/workspaces/${direct}/expenses`, alice)
        .send({
          description: 'Taxi',
          amount: 20,
          date: today(),
          payers: [{ userId: alice.id, amount: 20 }],
          participants: [alice.id, bob.id],
        })
        .expect(201);
      const debts = await api('get', `/workspaces/${direct}/balances/debts`, bob).expect(200);
      expect(debts.body).toEqual([
        expect.objectContaining({ debtor: bob.id, creditor: alice.id, amount: 10 }),
      ]);

      await api('post', `/friends/${alice.id}/workspace`, alice).expect(400);
      const stranger = await makeUser('stranger');
      await api('post', `/friends/${stranger.id}/workspace`, alice).expect(404);
    });
  });

  describe('speed and sync', () => {
    let ws2: string;
    const payload = () => ({
      description: 'Pizza',
      amount: 24,
      date: new Date().toISOString(),
      payers: [{ userId: alice.id, amount: 24 }],
      participants: [alice.id, bob.id],
    });

    beforeAll(async () => {
      ws2 = (await api('post', '/workspaces', alice).send({ name: 'Sync' })).body.id;
      await api('post', `/workspaces/${ws2}/members`, alice).send({ email: `bob-${tag}@test.dev` });
    });

    const count = async () =>
      (await api('get', `/workspaces/${ws2}/expenses`, alice)).body.length as number;

    it('runs a write once per Idempotency-Key and replays the result', async () => {
      const key = `key-${tag}-a`;
      const first = await api('post', `/workspaces/${ws2}/expenses`, alice)
        .set('Idempotency-Key', key)
        .send(payload())
        .expect(201);
      const retry = await api('post', `/workspaces/${ws2}/expenses`, alice)
        .set('Idempotency-Key', key)
        .send(payload())
        .expect(201);
      expect(retry.body.id).toBe(first.body.id);
      expect(await count()).toBe(1);
    });

    it('scopes keys to the user and the endpoint', async () => {
      const key = `key-${tag}-b`;
      await api('post', `/workspaces/${ws2}/expenses`, alice)
        .set('Idempotency-Key', key)
        .send(payload())
        .expect(201);
      // Same key, different endpoint: refused instead of replaying the wrong response.
      await api('post', `/workspaces/${ws2}/settlements`, alice)
        .set('Idempotency-Key', key)
        .send({ payerId: bob.id, payeeId: alice.id, amount: 1, date: new Date().toISOString() })
        .expect(422);
      // Another user may reuse the same key string independently.
      await api('post', `/workspaces/${ws2}/expenses`, bob)
        .set('Idempotency-Key', key)
        .send(payload())
        .expect(201);
      await api('post', `/workspaces/${ws2}/expenses`, alice)
        .set('Idempotency-Key', 'short')
        .send(payload())
        .expect(400);
    });

    it('lets a failed request be retried with the same key', async () => {
      const key = `key-${tag}-c`;
      await api('post', `/workspaces/${ws2}/expenses`, alice)
        .set('Idempotency-Key', key)
        .send({ ...payload(), amount: -5 })
        .expect(400);
      await api('post', `/workspaces/${ws2}/expenses`, alice)
        .set('Idempotency-Key', key)
        .send(payload())
        .expect(201);
    });

    it('streams workspace events to members only', async () => {
      await app.listen(0);
      const port = (app.getHttpServer().address() as { port: number }).port;
      const open = (as: { auth: object }) =>
        new Promise<http.IncomingMessage>((resolve) =>
          http.get(
            {
              port,
              path: `/api/v1/workspaces/${ws2}/events`,
              headers: as.auth as http.OutgoingHttpHeaders,
            },
            resolve,
          ),
        );

      expect((await open(eve)).statusCode).toBe(404);

      const stream = await open(bob);
      expect(stream.statusCode).toBe(200);
      expect(stream.headers['content-type']).toContain('text/event-stream');
      const received = new Promise<string>((resolve) => {
        let buffer = '';
        stream.on('data', (chunk) => {
          buffer += chunk.toString();
          if (buffer.includes('expense.created')) resolve(buffer);
        });
      });

      await api('post', `/workspaces/${ws2}/expenses`, alice).send(payload()).expect(201);
      const text = await received;
      expect(text).toContain('event: expense.created');
      expect(text).toContain(`"workspaceId":"${ws2}"`);
      stream.destroy();
    });
  });

  describe('money across currencies and payment links', () => {
    let trip: string;
    beforeAll(async () => {
      await db.delete(fxRates); // start from an empty rate cache so the fake provider is used
      trip = (await api('post', '/workspaces', alice).send({ name: 'Trip abroad' })).body.id;
      await api('post', `/workspaces/${trip}/members`, alice).send({
        email: `bob-${tag}@test.dev`,
      });
      for (const [description, amount, currency] of [
        ['Hotel', 100, 'USD'],
        ['Taxi', 400, 'INR'],
      ] as const) {
        await api('post', `/workspaces/${trip}/expenses`, alice)
          .send({
            description,
            amount,
            currency,
            date: new Date().toISOString(),
            payers: [{ userId: alice.id, amount }],
            participants: [alice.id, bob.id],
          })
          .expect(201);
      }
    });

    it('keeps each currency separate, and converts on request', async () => {
      const plain = await api('get', `/workspaces/${trip}/balances`, alice).expect(200);
      const owed = Object.fromEntries(
        plain.body.byCurrency.map((c: { currency: string; owedToYou: number }) => [
          c.currency,
          c.owedToYou,
        ]),
      );
      expect(owed).toEqual({ USD: 50, INR: 200 });
      expect(plain.body.converted).toBeUndefined();

      // 50 USD + 200 INR at INR 80 per USD (provider is faked) = 52.50 USD
      const converted = await api(
        'get',
        `/workspaces/${trip}/balances?convertTo=usd`,
        alice,
      ).expect(200);
      expect(converted.body.converted).toEqual({ currency: 'USD', owedToYou: 52.5, youOwe: 0 });
    });

    it('serves exchange rates', async () => {
      const res = await api('get', '/fx/rates?base=USD', alice).expect(200);
      expect(res.body).toEqual({
        base: 'USD',
        date: '2026-10-29',
        rates: { EUR: 0.5, INR: 80, JPY: 150 },
      });
      await api('get', '/fx/rates?base=nope', alice).expect(400);
    });

    it('builds payment links from the payee’s saved handles', async () => {
      await api('patch', '/users/me', alice)
        .send({ upiVpa: 'alice@okbank', paypalMe: 'alicep' })
        .expect(200);
      await api('patch', '/users/me', alice).send({ upiVpa: 'not a vpa' }).expect(400);

      const inr = await api(
        'get',
        `/payment-links?payeeId=${alice.id}&amount=200&currency=INR&note=Taxi`,
        bob,
      ).expect(200);
      expect(inr.body.links.map((l: { method: string }) => l.method)).toEqual(['UPI', 'PAYPAL']);
      expect(inr.body.links[0].url).toBe(
        'upi://pay?pa=alice%40okbank&pn=alice&am=200.00&cu=INR&tn=Taxi',
      );

      const usd = await api(
        'get',
        `/payment-links?payeeId=${alice.id}&amount=50&currency=USD`,
        bob,
      ).expect(200);
      expect(usd.body.links.map((l: { method: string }) => l.method)).toEqual(['PAYPAL']);

      // Handles clear with null, and strangers can't look anyone up.
      await api('patch', '/users/me', alice).send({ upiVpa: null, paypalMe: null }).expect(200);
      expect(
        (await api('get', `/payment-links?payeeId=${alice.id}&amount=5&currency=INR`, bob)).body
          .links,
      ).toEqual([]);
      await api('get', `/payment-links?payeeId=${alice.id}&amount=5&currency=INR`, eve).expect(404);
    });
  });

  describe('recurring expenses', () => {
    let home: string;
    const rule = (over: object = {}) => ({
      description: 'Netflix',
      amount: 15,
      startDate: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      interval: 'DAILY',
      payers: [{ userId: alice.id, amount: 15 }],
      participants: [alice.id, bob.id],
      ...over,
    });
    const netflix = async () =>
      (await api('get', `/workspaces/${home}/expenses?q=Netflix`, alice)).body as Array<{
        id: string;
      }>;

    beforeAll(async () => {
      home = (await api('post', '/workspaces', alice).send({ name: 'Subscriptions' })).body.id;
      await api('post', `/workspaces/${home}/members`, alice).send({
        email: `bob-${tag}@test.dev`,
      });
    });

    it('creates the occurrences that are already due, once each', async () => {
      const res = await api('post', `/workspaces/${home}/recurring`, alice)
        .send(rule())
        .expect(201);
      expect(res.body.runCount).toBe(4); // 3 days ago, 2, 1, and today
      expect(new Date(res.body.nextRunAt).getTime()).toBeGreaterThan(Date.now());
      expect(await netflix()).toHaveLength(4);

      // The scheduler (and a second server instance) running again must not duplicate anything.
      const runner = app.get(RecurringService);
      await Promise.all([runner.runDue(), runner.runDue()]);
      expect(await netflix()).toHaveLength(4);
    });

    it('rejects a template that could never be saved', async () => {
      await api('post', `/workspaces/${home}/recurring`, alice)
        .send(rule({ description: 'Bad', participants: [alice.id, eve.id] }))
        .expect(400);
      await api('post', `/workspaces/${home}/recurring`, alice)
        .send(rule({ interval: 'YEARLY' }))
        .expect(400);
      expect(
        (await api('get', `/workspaces/${home}/recurring`, alice)).body.map(
          (r: { template: { description: string } }) => r.template.description,
        ),
      ).toEqual(['Netflix']);
    });

    it('lets the creator or an admin pause, skip and cancel — and nobody else', async () => {
      const bobsRule = (
        await api('post', `/workspaces/${home}/recurring`, bob).send(
          rule({
            description: 'Gym',
            startDate: new Date(Date.now() + 86_400_000).toISOString(),
            payers: [{ userId: bob.id, amount: 15 }],
          }),
        )
      ).body;
      expect(await netflix()).toHaveLength(4);
      const aliceRule = (await api('get', `/workspaces/${home}/recurring`, alice)).body.find(
        (r: { template: { description: string } }) => r.template.description === 'Netflix',
      );

      await api('patch', `/workspaces/${home}/recurring/${aliceRule.id}`, bob)
        .send({ active: false })
        .expect(403);
      await api('delete', `/workspaces/${home}/recurring/${aliceRule.id}`, bob).expect(403);

      const paused = await api('patch', `/workspaces/${home}/recurring/${aliceRule.id}`, alice)
        .send({ active: false })
        .expect(200);
      expect(paused.body.active).toBe(false);
      const resumed = await api('patch', `/workspaces/${home}/recurring/${aliceRule.id}`, alice)
        .send({ active: true })
        .expect(200);
      expect(new Date(resumed.body.nextRunAt).getTime()).toBeGreaterThan(Date.now());

      const skipped = await api(
        'post',
        `/workspaces/${home}/recurring/${aliceRule.id}/skip`,
        alice,
      ).expect(200);
      expect(skipped.body.runCount).toBe(resumed.body.runCount + 1);

      // An admin may cancel someone else's rule.
      await api('delete', `/workspaces/${home}/recurring/${bobsRule.id}`, alice).expect(204);
      await api('delete', `/workspaces/${home}/recurring/${aliceRule.id}`, alice).expect(204);
      await api('get', `/workspaces/${home}/recurring`, eve).expect(404);
    });
  });

  describe('notifications and nudges', () => {
    let flat2: string;
    const eventually = async <T>(check: () => Promise<T | false>, ms = 4000): Promise<T> => {
      const end = Date.now() + ms;
      for (;;) {
        const value = await check();
        if (value) return value;
        if (Date.now() > end) throw new Error('condition not met in time');
        await new Promise((r) => setTimeout(r, 50));
      }
    };
    const inbox = async (as: { auth: object }) => (await api('get', '/notifications', as)).body;

    beforeAll(async () => {
      flat2 = (await api('post', '/workspaces', alice).send({ name: 'Notify' })).body.id;
      await api('post', `/workspaces/${flat2}/members`, alice).send({
        email: `bob-${tag}@test.dev`,
      });
      await api('post', `/workspaces/${flat2}/members`, alice).send({
        email: `carol-${tag}@test.dev`,
      });
    });

    const addExpense = (as: { auth: object }, payer: string, description: string, amount = 30) =>
      api('post', `/workspaces/${flat2}/expenses`, as)
        .send({
          description,
          amount,
          date: new Date().toISOString(),
          payers: [{ userId: payer, amount }],
          participants: [alice.id, bob.id, carol.id],
        })
        .expect(201);

    it('tells the people involved, but not the person who did it', async () => {
      await addExpense(bob, bob.id, 'Tickets');
      const mine = await eventually(async () => {
        const n = await inbox(alice);
        return (
          n.items.some(
            (i: { payload: { description?: string } }) => i.payload.description === 'Tickets',
          ) && n
        );
      });
      expect(mine.unreadCount).toBeGreaterThan(0);
      const item = mine.items.find(
        (i: { payload: { description?: string } }) => i.payload.description === 'Tickets',
      );
      expect(item.message).toEqual({ title: 'bob added "Tickets"', body: '30.00 USD in Notify' });
      expect(
        (await inbox(bob)).items.filter(
          (i: { payload: { description?: string } }) => i.payload.description === 'Tickets',
        ),
      ).toHaveLength(0);
    });

    it('marks notifications read, one at a time or all at once', async () => {
      const { items } = await inbox(alice);
      await api('patch', `/notifications/${items[0].id}/read`, alice).expect(204);
      const after = await inbox(alice);
      expect(after.items.find((i: { id: string }) => i.id === items[0].id).readAt).toBeTruthy();
      await api('post', '/notifications/read-all', alice).expect(204);
      expect((await inbox(alice)).unreadCount).toBe(0);
      // Someone else's notification can't be marked.
      await api('patch', `/notifications/${items[0].id}/read`, eve).expect(204);
      expect((await inbox(alice)).items[0].readAt).toBeTruthy();
    });

    it('respects muted notification kinds', async () => {
      await api('patch', '/users/me', carol)
        .send({ mutedNotificationKinds: ['expense.added'] })
        .expect(200);
      await api('patch', '/users/me', carol)
        .send({ mutedNotificationKinds: ['nonsense'] })
        .expect(400);
      await addExpense(alice, alice.id, 'Muted lunch');
      await eventually(async () =>
        (await inbox(bob)).items.some(
          (i: { payload: { description?: string } }) => i.payload.description === 'Muted lunch',
        ),
      );
      expect(
        (await inbox(carol)).items.filter(
          (i: { payload: { description?: string } }) => i.payload.description === 'Muted lunch',
        ),
      ).toHaveLength(0);
    });

    it('keeps push subscriptions per user and reports push as off without keys', async () => {
      expect((await api('get', '/push/public-key', alice).expect(200)).body).toEqual({
        publicKey: null,
      });
      const sub = {
        endpoint: `https://push.example/${tag}`,
        keys: { p256dh: 'p'.repeat(20), auth: 'a'.repeat(10) },
      };
      await api('post', '/push/subscribe', alice).send(sub).expect(204);
      await api('post', '/push/subscribe', alice).send(sub).expect(204); // idempotent
      await api('post', '/push/subscribe', alice)
        .send({ endpoint: 'not a url', keys: sub.keys })
        .expect(400);
      await api('post', '/push/unsubscribe', alice).send({ endpoint: sub.endpoint }).expect(204);
    });

    it('nudges someone who owes you, once a day', async () => {
      // After Tickets (Bob paid 30) and Muted lunch (Alice paid 30), both split three ways,
      // Carol is the one who owes: 10 to Alice and 10 to Bob.
      await api('post', `/workspaces/${flat2}/nudges`, bob).send({ userId: carol.id }).expect(200);
      await api('post', `/workspaces/${flat2}/nudges`, bob).send({ userId: carol.id }).expect(429);

      const nudge = await eventually(async () =>
        (await inbox(carol)).items.find((i: { kind: string }) => i.kind === 'nudge'),
      );
      expect(nudge.message.title).toBe('bob sent you a reminder');
      expect(nudge.payload).toEqual(expect.objectContaining({ amount: 10, currency: 'USD' }));
    });

    it('only nudges real debtors who are members', async () => {
      await api('post', `/workspaces/${flat2}/nudges`, alice).send({ userId: bob.id }).expect(400); // Bob owes nothing
      await api('post', `/workspaces/${flat2}/nudges`, alice).send({ userId: eve.id }).expect(400); // not a member
      await api('post', `/workspaces/${flat2}/nudges`, alice)
        .send({ userId: alice.id })
        .expect(400);
      await api('post', `/workspaces/${flat2}/nudges`, eve).send({ userId: bob.id }).expect(404);
    });
  });

  describe('receipts and itemized splits', () => {
    let shop: string;
    // 1x1 transparent PNG
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
      'base64',
    );
    const upload = (as: { auth: object }, body: Buffer, type = 'image/png', ws = shop) =>
      request(app.getHttpServer())
        .post(`/api/v1/workspaces/${ws}/receipts`)
        .set(as.auth as Record<string, string>)
        .set('Content-Type', type)
        .send(body);
    const finished = async (as: { auth: object }, id: string) => {
      for (let i = 0; i < 80; i++) {
        const res = await api('get', `/workspaces/${shop}/receipts/${id}`, as);
        if (res.body.status !== 'PROCESSING') return res.body;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw new Error('scan did not finish');
    };

    beforeAll(async () => {
      shop = (await api('post', '/workspaces', alice).send({ name: 'Dinner out' })).body.id;
      await api('post', `/workspaces/${shop}/members`, alice).send({
        email: `bob-${tag}@test.dev`,
      });
    });

    it('scans an uploaded receipt in the background and cleans the result up', async () => {
      const accepted = await upload(alice, png).expect(202);
      expect(accepted.body.status).toBe('PROCESSING');
      const done = await finished(alice, accepted.body.id);
      expect(done.status).toBe('DONE');
      expect(done.result).toEqual(
        expect.objectContaining({
          merchant: 'Joe’s Pizza Restaurant',
          currency: 'USD',
          total: 50,
          mismatch: false,
          suggestedCategory: 'Food & Drink',
        }),
      );
      expect(done.result.items).toHaveLength(3);
    });

    it('reports a scan that failed, so the user can enter items by hand', async () => {
      const accepted = await upload(alice, Buffer.concat([png, Buffer.from('FAIL')])).expect(202);
      const done = await finished(alice, accepted.body.id);
      expect(done).toEqual(
        expect.objectContaining({ status: 'FAILED', error: 'unreadable receipt' }),
      );
    });

    it('checks the bytes, not the Content-Type, and rejects non-images', async () => {
      await upload(alice, Buffer.from('<html><script>alert(1)</script></html>')).expect(400);
      await upload(alice, png, 'text/plain').expect(415);
      await upload(alice, Buffer.alloc(0)).expect(415);
    });

    it('keeps receipts private to the workspace', async () => {
      const { body } = await upload(alice, png).expect(202);
      await upload(eve, png).expect(404);
      await api('get', `/workspaces/${shop}/receipts/${body.id}`, eve).expect(404);
      await api('get', `/workspaces/${shop}/receipts/${body.id}/image`, eve).expect(404);

      const image = await api('get', `/workspaces/${shop}/receipts/${body.id}/image`, bob).expect(
        200,
      );
      expect(image.headers['content-type']).toBe('image/png');
      expect(image.headers['x-content-type-options']).toBe('nosniff');
      expect(Buffer.compare(image.body, png)).toBe(0);

      // A receipt id from another workspace can't be read through this one.
      await api('get', `/workspaces/${ws}/receipts/${body.id}`, alice).expect(404);
    });

    it('turns a scanned receipt into an itemized expense, with tax and tip shared fairly', async () => {
      const res = await api('post', `/workspaces/${shop}/expenses`, alice)
        .send({
          description: 'Joe’s Pizza',
          amount: 50,
          category: 'Food & Drink',
          date: new Date().toISOString(),
          splitType: 'ITEMIZED',
          payers: [{ userId: alice.id, amount: 50 }],
          items: [
            { name: 'Pasta', amount: 20, assignees: [alice.id] },
            { name: 'Salad', amount: 10, assignees: [bob.id] },
            { name: 'Starter', amount: 10, assignees: [alice.id, bob.id] },
          ],
          tax: 4,
          tip: 6,
        })
        .expect(201);
      expect(res.body.category).toBe('Food & Drink');
      const owed = Object.fromEntries(
        res.body.splits.map((s: { userId: string; amountOwed: string }) => [
          s.userId,
          Number(s.amountOwed),
        ]),
      );
      expect(owed).toEqual({ [alice.id]: 31.25, [bob.id]: 18.75 });

      // Items that don't add up to the total are refused, and editing keeps the items.
      await api('post', `/workspaces/${shop}/expenses`, alice)
        .send({
          description: 'Wrong',
          amount: 60,
          date: new Date().toISOString(),
          splitType: 'ITEMIZED',
          payers: [{ userId: alice.id, amount: 60 }],
          items: [{ name: 'Pasta', amount: 20, assignees: [alice.id] }],
        })
        .expect(400);
      const edited = await api('patch', `/expenses/${res.body.id}`, alice)
        .send({ description: 'Pizza night' })
        .expect(200);
      expect(edited.body.description).toBe('Pizza night');

      const debts = await api('get', `/workspaces/${shop}/balances/debts`, bob).expect(200);
      expect(debts.body).toEqual([
        expect.objectContaining({ debtor: bob.id, creditor: alice.id, amount: 18.75 }),
      ]);
    });

    it('filters expenses by category', async () => {
      await api('post', `/workspaces/${shop}/expenses`, alice)
        .send({
          description: 'Taxi home',
          amount: 12,
          category: 'Transport',
          date: new Date().toISOString(),
          payers: [{ userId: alice.id, amount: 12 }],
          participants: [alice.id, bob.id],
        })
        .expect(201);
      const taxis = await api(
        'get',
        `/workspaces/${shop}/expenses?category=Transport`,
        alice,
      ).expect(200);
      expect(taxis.body.map((e: { description: string }) => e.description)).toEqual(['Taxi home']);
    });
  });

  describe('browser access (CORS)', () => {
    // A header the server does not allow makes the browser drop the real request, and no
    // server-side test can see that: so assert on the preflight itself.
    it.each(['Idempotency-Key', 'Authorization', 'Content-Type'])(
      'allows the web app to send %s',
      async (header) => {
        const res = await request(app.getHttpServer())
          .options('/api/v1/workspaces/x/expenses')
          .set('Origin', 'http://localhost:5173')
          .set('Access-Control-Request-Method', 'POST')
          .set('Access-Control-Request-Headers', header.toLowerCase())
          .expect(204);
        expect(res.headers['access-control-allow-headers'].toLowerCase()).toContain(
          header.toLowerCase(),
        );
        expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      },
    );

    it('lets the web app read the pagination cursor', async () => {
      const res = await api('get', '/workspaces', alice).set('Origin', 'http://localhost:5173');
      expect(res.headers['access-control-expose-headers']).toContain('x-next-cursor');
    });

    it('never echoes a foreign origin or a wildcard', async () => {
      const res = await request(app.getHttpServer())
        .options('/api/v1/workspaces')
        .set('Origin', 'https://evil.example')
        .set('Access-Control-Request-Method', 'GET');
      // The browser compares this with the page's origin and blocks the mismatch.
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });
  });

  describe('analytics, budgets and data transfer', () => {
    let books: string;
    const now = new Date();
    const lastMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15, 12),
    ).toISOString();
    const spend = (
      description: string,
      amount: number,
      opts: {
        currency?: string;
        category?: string;
        tags?: string[];
        date?: string;
        workspace?: string;
      } = {},
    ) =>
      api('post', `/workspaces/${opts.workspace ?? books}/expenses`, alice)
        .send({
          description,
          amount,
          currency: opts.currency ?? 'USD',
          category: opts.category ?? 'Other',
          tags: opts.tags ?? [],
          date: opts.date ?? new Date().toISOString(),
          payers: [{ userId: alice.id, amount }],
          participants: [alice.id, bob.id],
        })
        .expect(201);
    const analytics = async (query = '') =>
      (await api('get', `/workspaces/${books}/analytics${query}`, alice).expect(200)).body
        .byCurrency as Array<Record<string, any>>;
    const usd = (rows: Array<Record<string, any>>) => rows.find((r) => r.currency === 'USD')!;

    beforeAll(async () => {
      books = (await api('post', '/workspaces', alice).send({ name: 'Books' })).body.id;
      await api('post', `/workspaces/${books}/members`, alice).send({
        email: `bob-${tag}@test.dev`,
      });
      await spend('Dinner', 40, { category: 'Food & Drink', tags: ['dinner'] });
      await spend('Cab', 20, { category: 'Transport', tags: ['dinner', 'trip'] });
      await spend('Groceries', 100, { currency: 'EUR', category: 'Groceries' });
      await spend('Old bill', 50, { category: 'Utilities', date: lastMonth });
    });

    it('reports real numbers per currency', async () => {
      const rows = await analytics();
      expect(rows.map((r) => r.currency).sort()).toEqual(['EUR', 'USD']);
      const u = usd(rows);
      expect(u).toEqual(
        expect.objectContaining({
          totalSpend: 110,
          expenseCount: 3,
          thisMonthSpend: 60,
          lastMonthSpend: 50,
          monthOverMonthChange: 20,
          trueSpending: 55, // Alice's share of 110
          cashOut: 110, // Alice paid for everything
          todaySpend: 60,
        }),
      );
      expect(u.topCategories).toEqual([
        { description: 'Utilities', count: 1, total: 50 },
        { description: 'Food & Drink', count: 1, total: 40 },
        { description: 'Transport', count: 1, total: 20 },
      ]);
      expect(u.averageExpense).toBe(36.67);
      expect(u.previousPeriodSpend).toBeNull(); // "all time" has no previous window
      expect(u.biggestExpenses.map((e: { amount: number }) => e.amount)).toEqual([50, 40, 20]);
      expect(u.yourShareByCategory).toEqual([
        { category: 'Utilities', total: 25 },
        { category: 'Food & Drink', total: 20 },
        { category: 'Transport', total: 10 },
      ]);
      expect(usd(await analytics(`?from=${lastMonth}`)).previousPeriodSpend).not.toBeNull(); // a bounded period compares with the window before it
      expect(u.tagsAnalysis).toEqual([
        { tag: 'dinner', total: 60 },
        { tag: 'trip', total: 20 },
      ]);
      expect(u.spendByMember.map((m: { amount: number }) => m.amount)).toEqual([55, 55]);
      expect(rows.find((r) => r.currency === 'EUR')!.totalSpend).toBe(100);
    });

    it('filters by currency and date range, and groups by month', async () => {
      expect((await analytics('?currency=eur')).map((r) => r.currency)).toEqual(['EUR']);

      const monthStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      ).toISOString();
      expect(usd(await analytics(`?from=${monthStart}`)).totalSpend).toBe(60);

      const monthly = usd(await analytics('?groupBy=month')).spendOverTime;
      expect(monthly.map((p: { amount: number }) => p.amount)).toEqual([50, 60]);
      expect(monthly[0].date.endsWith('-01')).toBe(true);

      await api('get', `/workspaces/${books}/analytics?groupBy=year`, alice).expect(400);
      await api('get', `/workspaces/${books}/analytics`, eve).expect(404);
      const global = await api('get', '/analytics', alice).expect(200);
      expect(usd(global.body.byCurrency).totalSpend).toBeGreaterThanOrEqual(110);
    });

    it('lists tags by use for autocomplete', async () => {
      const res = await api('get', `/workspaces/${books}/tags`, bob).expect(200);
      expect(res.body).toEqual([
        { tag: 'dinner', count: 2 },
        { tag: 'trip', count: 1 },
      ]);
    });

    it('exports a Splitwise-style CSV that is safe to open in a spreadsheet', async () => {
      await spend('=HYPERLINK("http://evil.example","click")', 10);
      const res = await api('get', `/workspaces/${books}/export.csv`, bob).expect(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment');
      const lines = res.text
        .replace(/^\uFEFF/, '')
        .trim()
        .split(/\r\n/);
      expect(lines[0]).toBe('Date,Description,Category,Cost,Currency,alice,bob');
      expect(lines.some((l) => l.includes(',Dinner,Food & Drink,40,USD,20,-20'))).toBe(true);
      // The formula is neutralised, never emitted raw at the start of a cell.
      expect(lines.some((l) => l.includes(`'=HYPERLINK`))).toBe(true);
      expect(lines.some((l) => /,=HYPERLINK/.test(l) || /^=/.test(l))).toBe(false);
      await api('get', `/workspaces/${books}/export.csv`, eve).expect(404);
    });

    const importInto = (target: string, csv: string, as = alice, query = '') =>
      request(app.getHttpServer())
        .post(`/api/v1/workspaces/${target}/import/splitwise${query}`)
        .set(as.auth as Record<string, string>)
        .set('Content-Type', 'text/csv')
        .send(csv);
    const debtsOf = async (target: string) =>
      (await api('get', `/workspaces/${target}/balances/debts`, alice)).body
        .map(
          (d: { debtor: string; creditor: string; amount: number; currency: string }) =>
            `${d.currency} ${d.amount}`,
        )
        .sort();

    it('imports what it exported, previews first, and never imports twice', async () => {
      const csv = (await api('get', `/workspaces/${books}/export.csv`, alice)).text;
      const copy = (await api('post', '/workspaces', alice).send({ name: 'Books copy' })).body.id;
      await api('post', `/workspaces/${copy}/members`, alice).send({
        email: `bob-${tag}@test.dev`,
      });

      const preview = await importInto(copy, csv, alice, '?dryRun=true').expect(200);
      expect(preview.body).toEqual(
        expect.objectContaining({ expenses: 5, payments: 0, dryRun: true, errors: [] }),
      );
      expect((await api('get', `/workspaces/${copy}/expenses`, alice)).body).toHaveLength(0);

      const done = await importInto(copy, csv).expect(200);
      expect(done.body).toEqual(
        expect.objectContaining({ expenses: 5, skippedDuplicates: 0, errors: [] }),
      );
      expect(await debtsOf(copy)).toEqual(await debtsOf(books));

      const again = await importInto(copy, csv).expect(200);
      expect(again.body).toEqual(expect.objectContaining({ expenses: 0, skippedDuplicates: 5 }));
      expect((await api('get', `/workspaces/${copy}/expenses`, alice)).body).toHaveLength(5);

      await importInto(copy, csv, bob).expect(403); // admins only
    });

    it('asks you to match unknown names, imports payments, and reports bad rows', async () => {
      const target = (await api('post', '/workspaces', alice).send({ name: 'Imports' })).body.id;
      await api('post', `/workspaces/${target}/members`, alice).send({
        email: `bob-${tag}@test.dev`,
      });
      const csv = [
        'Date,Description,Category,Cost,Currency,alice,Zed',
        '2026-01-05,Rent,Rent,100.00,USD,100.00,-100.00',
        '2026-01-06,Payment,Payment,40.00,USD,-40.00,40.00',
        '2026-01-07,Broken,Other,10.00,USD,5.00,-4.00',
        '',
      ].join('\n');

      const unmatched = await importInto(target, csv).expect(400);
      expect(unmatched.body.unmatched).toEqual(['Zed']);
      expect(unmatched.body.members.map((m: { name: string }) => m.name).sort()).toEqual([
        'alice',
        'bob',
      ]);

      const mapping = encodeURIComponent(JSON.stringify({ Zed: bob.id }));
      const res = await importInto(target, csv, alice, `?mapping=${mapping}`).expect(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          expenses: 1,
          payments: 1,
          errors: [{ line: 4, message: 'The balances in this row do not add up to zero' }],
        }),
      );
      // Bob owes Alice 100 for rent, then paid her 40 back: 60 left.
      expect(await debtsOf(target)).toEqual(['USD 60']);

      await importInto(target, 'a,b\n1,2').expect(400);
      await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${target}/import/splitwise`)
        .set(alice.auth as Record<string, string>)
        .send({ csv })
        .expect(415);
    });

    it('warns the group at 80% and 100% of a budget, once each', async () => {
      await api('put', `/workspaces/${books}/budgets`, bob)
        .send({ category: 'Food & Drink', currency: 'USD', amount: 50 })
        .expect(403);
      await api('put', `/workspaces/${books}/budgets`, alice)
        .send({ category: 'Pets', currency: 'USD', amount: 50 })
        .expect(400);
      const budget = await api('put', `/workspaces/${books}/budgets`, alice)
        .send({ category: 'Food & Drink', currency: 'usd', amount: 50 })
        .expect(200);
      expect(budget.body).toEqual(
        expect.objectContaining({ spent: 40, percent: 80, currency: 'USD' }),
      );

      const alerts = async () =>
        (await api('get', '/notifications?limit=100', bob)).body.items.filter(
          (n: { kind: string; workspaceId: string }) =>
            n.kind === 'budget.alert' && n.workspaceId === books,
        );
      const settle = () => new Promise((r) => setTimeout(r, 600));

      await spend('Lunch', 5, { category: 'Food & Drink' }); // 45 of 50 = 90%
      await settle();
      expect(
        (await alerts()).map((n: { payload: { percent: number } }) => n.payload.percent),
      ).toEqual([80]);

      await spend('Snacks', 3, { category: 'Food & Drink' }); // 48 = 96%: no new threshold crossed
      await settle();
      expect(await alerts()).toHaveLength(1);

      await spend('Dessert', 10, { category: 'Food & Drink' }); // 58 = 116%
      await spend('Coffee', 4, { category: 'Food & Drink' }); // still over: already announced
      await settle();
      const sent = await alerts();
      expect(sent.map((n: { payload: { percent: number } }) => n.payload.percent).sort()).toEqual([
        100, 80,
      ]);
      expect(sent[0].message.title).toMatch(/^Budget (80|100)% used$/);

      const list = await api('get', `/workspaces/${books}/budgets`, bob).expect(200);
      expect(list.body[0]).toEqual(
        expect.objectContaining({ category: 'Food & Drink', spent: 62, percent: 124 }),
      );

      await api('delete', `/workspaces/${books}/budgets/${budget.body.id}`, bob).expect(403);
      await api('delete', `/workspaces/${books}/budgets/${budget.body.id}`, alice).expect(204);
      await api('delete', `/workspaces/${books}/budgets/${budget.body.id}`, alice).expect(404);
    });
  });

  describe('metrics', () => {
    it('records request timings by route template and counts live connections', async () => {
      await api('get', `/workspaces/${ws}/expenses`, alice).expect(200);
      await api('get', `/workspaces/${ws}/expenses`, eve).expect(404);
      const res = await request(app.getHttpServer()).get('/metrics').expect(200);
      // Concrete ids never appear as labels: only the template does.
      expect(res.text).toContain(
        'http_request_duration_seconds_count{method="GET",route="/api/v1/workspaces/:workspaceId/expenses",status="200"}',
      );
      expect(res.text).toContain('route="/api/v1/workspaces/:workspaceId/expenses",status="404"');
      expect(res.text).not.toContain(ws);
      expect(res.text).toMatch(/\nsse_connections 0\n/);
    });
  });

  describe('cached pairwise debts', () => {
    let pair: string;
    const raw = async () =>
      (
        await api('get', `/workspaces/${pair}/balances/debts?simplified=false`, alice).expect(200)
      ).body.map(
        (d: { debtor: string; amount: number }) =>
          `${d.debtor === bob.id ? 'bob' : 'alice'} ${d.amount}`,
      ) as string[];
    let first: string;

    beforeAll(async () => {
      pair = (await api('post', '/workspaces', alice).send({ name: 'Cache check' })).body.id;
      await api('post', `/workspaces/${pair}/members`, alice).send({
        email: `bob-${tag}@test.dev`,
      });
      first = (
        await api('post', `/workspaces/${pair}/expenses`, alice).send({
          description: 'One',
          amount: 40,
          date: new Date().toISOString(),
          payers: [{ userId: alice.id, amount: 40 }],
          participants: [alice.id, bob.id],
        })
      ).body.id;
    });

    // A cache that kept serving stale balances would be worse than no cache at all.
    it('never serves stale numbers after the ledger changes', async () => {
      expect(await raw()).toEqual(['bob 20']);
      expect(await raw()).toEqual(['bob 20']); // served from the cache

      const second = (
        await api('post', `/workspaces/${pair}/expenses`, alice).send({
          description: 'Two',
          amount: 10,
          date: new Date().toISOString(),
          payers: [{ userId: alice.id, amount: 10 }],
          participants: [alice.id, bob.id],
        })
      ).body.id;
      expect(await raw()).toEqual(['bob 25']); // new expense

      await api('patch', `/expenses/${second}`, alice).send({ amount: 20 }).expect(200);
      expect(await raw()).toEqual(['bob 30']); // edited expense

      await api('delete', `/expenses/${second}`, alice).expect(204);
      expect(await raw()).toEqual(['bob 20']); // deleted

      await api('post', `/expenses/${second}/restore`, alice).expect(200);
      expect(await raw()).toEqual(['bob 30']); // restored

      await api('post', `/workspaces/${pair}/settlements`, bob)
        .send({ payerId: bob.id, payeeId: alice.id, amount: 5, date: new Date().toISOString() })
        .expect(201);
      expect(await raw()).toEqual(['bob 25']); // settlement

      await api('delete', `/expenses/${first}`, alice).expect(204);
      expect(await raw()).toEqual(['bob 5']);
    });
  });

  describe('account export and deletion', () => {
    let dana: Awaited<ReturnType<typeof makeUser>>;
    let erin: Awaited<ReturnType<typeof makeUser>>;
    let club: string;
    let danaExpense: string;
    const del = (as: { auth: object }, body: object = { confirm: 'DELETE' }) =>
      request(app.getHttpServer())
        .delete('/api/v1/users/me')
        .set(as.auth as Record<string, string>)
        .send(body);

    beforeAll(async () => {
      [dana, erin] = await Promise.all([makeUser('dana'), makeUser('erin')]);
      club = (await api('post', '/workspaces', dana).send({ name: 'Club' })).body.id;
      await api('post', `/workspaces/${club}/members`, dana).send({
        email: `erin-${tag}@test.dev`,
      });
      danaExpense = (
        await api('post', `/workspaces/${club}/expenses`, dana).send({
          description: 'Court hire',
          amount: 30,
          date: new Date().toISOString(),
          payers: [{ userId: dana.id, amount: 30 }],
          participants: [dana.id, erin.id],
        })
      ).body.id;
    });

    it('exports only your own data', async () => {
      const res = await api('get', '/users/me/export', dana).expect(200);
      expect(res.headers['content-disposition']).toContain('attachment');
      const data = JSON.parse(res.text);
      expect(data.profile.email).toBe(`dana-${tag}@test.dev`);
      expect(data.memberships.map((m: { name: string }) => m.name)).toEqual(['Club']);
      expect(data.created.map((e: { description: string }) => e.description)).toEqual([
        'Court hire',
      ]);
      expect(data.created.some((e: { description: string }) => e.description === 'Dinner')).toBe(
        false,
      );
      expect(JSON.stringify(data)).not.toContain(`erin-${tag}`);
      await request(app.getHttpServer()).get('/api/v1/users/me/export').expect(401);
    });

    it('needs an explicit confirmation', async () => {
      await del(dana, {}).expect(400);
      await del(dana, { confirm: 'yes' }).expect(400);
    });

    it('is refused while money is owed, with the reasons', async () => {
      const res = await del(dana).expect(400);
      expect(res.body.blockers).toEqual([
        { workspace: 'Club', reason: 'There is an unsettled balance. Settle up first.' },
      ]);
    });

    it('is refused for the only admin of a group with other members', async () => {
      await api('post', `/workspaces/${club}/settlements`, erin)
        .send({ payerId: erin.id, payeeId: dana.id, amount: 15, date: new Date().toISOString() })
        .expect(201);
      const res = await del(dana).expect(400);
      expect(res.body.blockers[0].reason).toContain('only admin');
      await api('patch', `/workspaces/${club}/members/${erin.id}`, dana)
        .send({ role: 'ADMIN' })
        .expect(200);
    });

    it('anonymises the account but keeps the ledger intact for everyone else', async () => {
      const session = await app.get(AuthService).validateOAuthLogin({
        emails: [{ value: `dana-${tag}@test.dev` }],
        name: { givenName: 'Dana', familyName: 'D' },
        photos: [],
      });
      await api('patch', '/users/me', dana).send({ paypalMe: 'danap' }).expect(200);

      await del(dana).expect(204);

      // The group and its expense live on, attributed to a placeholder.
      const expense = await api('get', `/expenses/${danaExpense}`, erin).expect(200);
      expect(expense.body.createdBy.name).toBe('Deleted user');
      expect(expense.body.createdBy.email).toMatch(/^deleted-.*@deleted\.invalid$/);
      expect(expense.body.createdBy.paypalMe).toBeNull();
      const members = await api('get', `/workspaces/${club}/members`, erin).expect(200);
      expect(members.body.map((m: { name: string }) => m.name)).toEqual(['erin']);

      // Dana is out of the group, and her sessions no longer refresh.
      await api('get', `/workspaces/${club}`, dana).expect(404);
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(401);
    });

    it('removes a group when its last member deletes their account', async () => {
      const gus = await makeUser('gus');
      const solo = (await api('post', '/workspaces', gus).send({ name: 'Solo club' })).body.id;
      // Straight to the service: the HTTP route is rate limited, and the tests have used its budget.
      await app.get(AccountService).deleteAccount(gus.id);
      const [row] = await db.select().from(workspaces).where(eq(workspaces.id, solo));
      expect(row).toBeUndefined();
    });

    it('rate limits deletion attempts', async () => {
      // Five attempts have already been made above from this client.
      const res = await del(erin).expect(429);
      expect(res.headers['retry-after']).toBeDefined();
      // ...and the account was not deleted by the refused request.
      await api('get', `/workspaces/${club}`, erin).expect(200);
    });
  });

  describe('categories and tags', () => {
    let ws: string;
    const spend = (body: object, as = alice) =>
      api('post', `/workspaces/${ws}/expenses`, as).send({
        date: new Date().toISOString(),
        description: 'Test',
        amount: 10,
        payers: [{ userId: alice.id, amount: 10 }],
        participants: [alice.id],
        ...body,
      });
    const categories = async () =>
      (await api('get', `/workspaces/${ws}/categories`, alice).expect(200)).body as Array<{
        id: string;
        name: string;
        parentId: string | null;
        expenseCount: number;
      }>;
    const idOf = async (name: string) => (await categories()).find((c) => c.name === name)!.id;

    beforeAll(async () => {
      ws = (await api('post', '/workspaces', alice).send({ name: 'Categories' })).body.id;
    });

    it('starts with the defaults and protects "Other"', async () => {
      const list = await categories();
      expect(list.map((c) => c.name)).toContain('Food & Drink');
      const other = list.find((c) => c.name === 'Other')!;
      await api('patch', `/workspaces/${ws}/categories/${other.id}`, alice)
        .send({ name: 'Misc' })
        .expect(400);
      await api('delete', `/workspaces/${ws}/categories/${other.id}`, alice).expect(400);
    });

    it('nests one level, rejects duplicates and cycles', async () => {
      const food = await idOf('Food & Drink');
      const child = await api('post', `/workspaces/${ws}/categories`, alice)
        .send({ name: 'Coffee', icon: '☕', parentId: food })
        .expect(201);
      await api('post', `/workspaces/${ws}/categories`, alice).send({ name: 'coffee' }).expect(409);
      await api('post', `/workspaces/${ws}/categories`, alice)
        .send({ name: 'Espresso', parentId: child.body.id })
        .expect(400); // too deep
      await api('patch', `/workspaces/${ws}/categories/${food}`, alice)
        .send({ parentId: child.body.id })
        .expect(400); // a parent cannot move under its own child
    });

    it('filters a parent by its whole branch, and renaming carries the expenses', async () => {
      await spend({ description: 'Latte', category: 'coffee' }).expect(201); // matched case-insensitively
      await spend({ description: 'Lunch', category: 'Food & Drink' }).expect(201);
      await spend({ description: 'Bus', category: 'Transport' }).expect(201);
      await spend({ description: 'Mystery', category: 'Nonexistent' }).expect(201);

      const names = async (q: string) =>
        (await api('get', `/workspaces/${ws}/expenses?${q}`, alice).expect(200)).body
          .map((e: { description: string }) => e.description)
          .sort();
      expect(await names('category=Food%20%26%20Drink')).toEqual(['Latte', 'Lunch']);
      expect(await names('category=Coffee')).toEqual(['Latte']);
      expect(await names('category=Other')).toEqual(['Mystery']);

      await api('patch', `/workspaces/${ws}/categories/${await idOf('Coffee')}`, alice)
        .send({ name: 'Cafés' })
        .expect(200);
      expect(await names('category=Caf%C3%A9s')).toEqual(['Latte']);
    });

    it('budgets on a parent count the sub-categories, and need a real category', async () => {
      const b = await api('put', `/workspaces/${ws}/budgets`, alice)
        .send({ category: 'food & drink', currency: 'USD', amount: 100 })
        .expect(200);
      expect(b.body.category).toBe('Food & Drink');
      expect(b.body.spent).toBe(20); // Lunch + the café latte
    });

    it('deleting moves expenses to the parent and children to the top level', async () => {
      const cafes = await idOf('Cafés');
      await api('delete', `/workspaces/${ws}/categories/${cafes}`, alice).expect(204);
      const list = await categories();
      expect(list.find((c) => c.name === 'Food & Drink')!.expenseCount).toBe(2);

      const food = await idOf('Food & Drink');
      const kid = await api('post', `/workspaces/${ws}/categories`, alice)
        .send({ name: 'Snacks', parentId: food })
        .expect(201);
      await api('delete', `/workspaces/${ws}/categories/${food}`, alice).expect(204);
      const after = await categories();
      expect(after.find((c) => c.id === kid.body.id)!.parentId).toBeNull();
      expect(after.find((c) => c.name === 'Other')!.expenseCount).toBe(3); // Lunch, Latte and Mystery
    });

    it('stores tags lower-case without the hash and suggests them as you type', async () => {
      await spend({ tags: ['#Trip', 'trip', 'Dinner'] }).expect(201);
      await spend({ tags: ['trip2026'] }).expect(201);
      await spend({ tags: ['TRIP'] }).expect(201);
      const all = (await api('get', `/workspaces/${ws}/tags`, alice).expect(200)).body;
      expect(all[0]).toEqual({ tag: 'trip', count: 2 });

      const typed = (await api('get', `/workspaces/${ws}/tags?q=Tri`, alice).expect(200)).body;
      expect(typed.map((t: { tag: string }) => t.tag)).toEqual(['trip', 'trip2026']);
      const inner = (await api('get', `/workspaces/${ws}/tags?q=nner`, alice).expect(200)).body;
      expect(inner.map((t: { tag: string }) => t.tag)).toEqual(['dinner']);
      const wildcard = (await api('get', `/workspaces/${ws}/tags?q=%25`, alice).expect(200)).body;
      expect(wildcard).toEqual([]);
      expect(
        (await api('get', `/workspaces/${ws}/tags?limit=1`, alice).expect(200)).body,
      ).toHaveLength(1);

      const found = (await api('get', `/workspaces/${ws}/expenses?tags=Trip`, alice).expect(200))
        .body;
      expect(found).toHaveLength(2);
      expect(found[0].paidBy).toBe(alice.id);
    });
  });

  describe('currencies and decimal places', () => {
    let money: string;
    const date = () => new Date().toISOString();
    const spend = (body: object, as = alice) =>
      api('post', `/workspaces/${money}/expenses`, as).send({
        date: date(),
        description: 'Test',
        ...body,
      });
    const equalSplit = (amount: number, currency: string, payer = alice) => ({
      amount,
      currency,
      payers: [{ userId: payer.id, amount }],
      participants: [alice.id, bob.id, carol.id],
    });

    beforeAll(async () => {
      money = (await api('post', '/workspaces', alice).send({ name: 'Many currencies' })).body.id;
      for (const u of ['bob', 'carol']) {
        await api('post', `/workspaces/${money}/members`, alice).send({
          email: `${u}-${tag}@test.dev`,
        });
      }
    });

    it('lists the supported currencies with their decimal places', async () => {
      const res = await api('get', '/currencies', alice).expect(200);
      const byCode = Object.fromEntries(res.body.map((c: { code: string }) => [c.code, c]));
      expect(byCode.USD).toEqual({ code: 'USD', name: 'US Dollar', symbol: '$', exponent: 2 });
      expect(byCode.JPY.exponent).toBe(0);
      expect(byCode.KWD.exponent).toBe(3);
      expect(byCode.XDR).toBeUndefined(); // accounting unit, not for payments
      expect(res.body.map((c: { code: string }) => c.code)).toEqual(
        res.body.map((c: { code: string }) => c.code).sort(),
      );
      expect(res.headers['cache-control']).toContain('max-age');
      await request(app.getHttpServer()).get('/api/v1/currencies').expect(401);
    });

    it('rejects unknown currencies and amounts with too many decimals, as client errors', async () => {
      await spend({ ...equalSplit(10, 'XYZ') }).expect(400);
      await spend({ ...equalSplit(10, 'XXX') }).expect(400);
      await spend({ ...equalSplit(10, '$') }).expect(400);
      const yen = await spend({ ...equalSplit(100.5, 'JPY') }).expect(400);
      expect(yen.body.message).toBe('JPY amounts have no decimal places');
      await spend({ ...equalSplit(10.005, 'USD') }).expect(400);
      await spend({ ...equalSplit(1.2345, 'KWD') }).expect(400);
      // Nothing about the failure leaks to the client beyond the message.
      expect(JSON.stringify(yen.body)).not.toContain('stack');
    });

    it('splits yen into whole yen, with no cents anywhere', async () => {
      const res = await spend({ ...equalSplit(1000, 'jpy') }).expect(201); // lower case is accepted
      expect(res.body.currency).toBe('JPY');
      const owed = res.body.splits.map((s: { amountOwed: string }) => Number(s.amountOwed)).sort();
      expect(owed).toEqual([333, 333, 334]);

      const balances = await api('get', `/workspaces/${money}/balances`, alice).expect(200);
      const jpy = balances.body.byCurrency.find((c: { currency: string }) => c.currency === 'JPY');
      expect(jpy.owedToYou).toBe(666); // 1000 paid minus Alice's own 334
      expect(Number.isInteger(jpy.total)).toBe(true);

      const debts = await api('get', `/workspaces/${money}/balances/debts`, alice).expect(200);
      const yen = debts.body.filter((d: { currency: string }) => d.currency === 'JPY');
      expect(yen.map((d: { amount: number }) => d.amount)).toEqual([333, 333]);
    });

    it('keeps three decimals for dinars, exactly', async () => {
      const res = await spend({
        amount: 10.001,
        currency: 'KWD',
        payers: [{ userId: alice.id, amount: 10.001 }],
        participants: [alice.id, bob.id],
      }).expect(201);
      const owed = Object.fromEntries(
        res.body.splits.map((s: { userId: string; amountOwed: string }) => [
          s.userId,
          Number(s.amountOwed),
        ]),
      );
      expect(owed).toEqual({ [alice.id]: 5.001, [bob.id]: 5 });

      const kwd = (
        await api('get', `/workspaces/${money}/balances`, bob).expect(200)
      ).body.byCurrency.find((c: { currency: string }) => c.currency === 'KWD');
      expect(kwd.youOwe).toBe(5);
      expect(kwd.total).toBe(5);
    });

    it('records settlements in the currency of the debt', async () => {
      await api('post', `/workspaces/${money}/settlements`, bob)
        .send({ payerId: bob.id, payeeId: alice.id, amount: 50.5, currency: 'JPY', date: date() })
        .expect(400);
      await api('post', `/workspaces/${money}/settlements`, bob)
        .send({ payerId: bob.id, payeeId: alice.id, amount: 100, currency: 'jpy', date: date() })
        .expect(201);
      const jpy = (await api('get', `/workspaces/${money}/balances`, alice)).body.byCurrency.find(
        (c: { currency: string }) => c.currency === 'JPY',
      );
      expect(jpy.owedToYou).toBe(566);
    });

    it('converts a total between currencies with different decimal places', async () => {
      const yen = (
        await api('post', '/workspaces', alice).send({ name: 'Yen only', defaultCurrency: 'JPY' })
      ).body.id;
      await api('post', `/workspaces/${yen}/members`, alice).send({ email: `bob-${tag}@test.dev` });
      await api('post', `/workspaces/${yen}/expenses`, alice)
        .send({
          description: 'Sushi',
          amount: 1000,
          currency: 'JPY',
          date: new Date().toISOString(),
          payers: [{ userId: alice.id, amount: 1000 }],
          participants: [alice.id, bob.id],
        })
        .expect(201);

      // Alice is owed 500 JPY; the fake provider says 1 JPY = 0.0067 USD, so 3.35 USD (not 335).
      const res = await api('get', `/workspaces/${yen}/balances?convertTo=usd`, alice).expect(200);
      expect(res.body.converted).toEqual({ currency: 'USD', owedToYou: 3.35, youOwe: 0 });

      await api('get', `/workspaces/${yen}/balances?convertTo=XYZ`, alice).expect(400);
      // A currency with no rate is refused, never guessed: the shared workspace holds KWD.
      const mixed = await api('get', `/workspaces/${money}/balances?convertTo=usd`, alice).expect(
        400,
      );
      expect(mixed.body.message).toContain('No exchange rate from KWD to USD');
    });

    it('validates the default currency of a workspace', async () => {
      await api('post', '/workspaces', alice)
        .send({ name: 'Bad currency', defaultCurrency: 'XYZ' })
        .expect(400);
      const ok = await api('post', '/workspaces', alice)
        .send({ name: 'Tokyo trip', defaultCurrency: 'jpy' })
        .expect(201);
      expect(ok.body.defaultCurrency).toBe('JPY');
      await api('patch', `/workspaces/${ok.body.id}`, alice)
        .send({ defaultCurrency: 'nope' })
        .expect(400);
    });

    it('keeps budgets, exports and imports in the currency precision', async () => {
      await api('put', `/workspaces/${money}/budgets`, alice)
        .send({ category: 'ALL', currency: 'JPY', amount: 1.5 })
        .expect(400);
      await api('put', `/workspaces/${money}/budgets`, alice)
        .send({ category: 'ALL', currency: 'JPY', amount: 10000 })
        .expect(200);

      const csv = (await api('get', `/workspaces/${money}/export.csv`, alice).expect(200)).text;
      expect(csv).toContain(',1000,JPY,'); // no ".00" on yen
      expect(csv).toContain(',10.001,KWD,');

      const target = (await api('post', '/workspaces', alice).send({ name: 'Imported yen' })).body
        .id;
      await api('post', `/workspaces/${target}/members`, alice).send({
        email: `bob-${tag}@test.dev`,
      });
      const sheet = [
        'Date,Description,Category,Cost,Currency,alice,bob',
        '2026-01-05,Ramen,Dining out,1500,JPY,750,-750',
        '',
      ].join('\n');
      const res = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${target}/import/splitwise`)
        .set(alice.auth as Record<string, string>)
        .set('Content-Type', 'text/csv')
        .send(sheet)
        .expect(200);
      expect(res.body).toEqual(expect.objectContaining({ expenses: 1, errors: [] }));
      const debts = await api('get', `/workspaces/${target}/balances/debts`, alice).expect(200);
      expect(debts.body).toEqual([
        expect.objectContaining({
          debtor: bob.id,
          creditor: alice.id,
          amount: 750,
          currency: 'JPY',
        }),
      ]);
    });

    it('rounds analytics to the currency, not to cents', async () => {
      const res = await api('get', `/workspaces/${money}/analytics`, alice).expect(200);
      const jpy = res.body.byCurrency.find((c: { currency: string }) => c.currency === 'JPY');
      const kwd = res.body.byCurrency.find((c: { currency: string }) => c.currency === 'KWD');
      expect(jpy.totalSpend).toBe(1000);
      expect(kwd.totalSpend).toBe(10.001);
      expect(kwd.spendByMember.map((m: { amount: number }) => m.amount).sort()).toEqual([5, 5.001]);
    });
  });
});
