import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import http from 'node:http';
import { AppModule } from '../src/app.module';
import { DRIZZLE_CLIENT } from '../src/database/database.module';
import type { DrizzleDb } from '../src/database/database.module';
import { fxRates, refreshTokens, users } from '../src/database/schema';
import { AuthService } from '../src/auth/auth.service';
import { RecurringService } from '../src/recurring/recurring.service';
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
          rates: base === 'INR' ? { USD: 0.0125 } : { EUR: 0.5, INR: 80 },
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
      expect(res.body).toEqual({ base: 'USD', date: '2026-10-29', rates: { EUR: 0.5, INR: 80 } });
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
});
