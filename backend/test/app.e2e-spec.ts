import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DRIZZLE_CLIENT } from '../src/database/database.module';
import type { DrizzleDb } from '../src/database/database.module';
import { refreshTokens, users } from '../src/database/schema';
import { AuthService } from '../src/auth/auth.service';
import { eq } from 'drizzle-orm';

// Runs against a real, migrated Postgres. Skipped unless TEST_DATABASE_URL is set.
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

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
    process.env.FRONTEND_URL = 'http://localhost:5173';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
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
});
