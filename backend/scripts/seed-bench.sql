-- Seeds one workspace with 8 members and 10,000 expenses (2-3 way equal splits over two years)
-- for load testing. Run against a THROWAWAY database only:
--   psql "$DATABASE_URL" -f scripts/seed-bench.sql
DO $$
DECLARE
  ws uuid; uids uuid[]; i int; eid uuid; payer uuid; picked uuid[]; amt numeric; share numeric; n int;
BEGIN
  INSERT INTO users (email, name)
    SELECT 'bench' || g || '@test.dev', 'Bench ' || g FROM generate_series(1, 8) g
    ON CONFLICT (email) DO NOTHING;
  SELECT array_agg(id ORDER BY email) INTO uids FROM users WHERE email LIKE 'bench_@test.dev';

  INSERT INTO workspaces (name) VALUES ('Bench 10k') RETURNING id INTO ws;
  INSERT INTO workspace_members (workspace_id, user_id, role)
    SELECT ws, u, 'MEMBER' FROM unnest(uids) u;

  FOR i IN 1..10000 LOOP
    payer := uids[1 + floor(random() * 8)::int];
    amt := round((5 + random() * 195)::numeric, 2);
    INSERT INTO expenses (workspace_id, created_by_id, description, amount, date, category, currency, tags)
      VALUES (ws, payer, 'Bench expense ' || i, amt,
              now() - (random() * 730 || ' days')::interval,
              (ARRAY['Food & Drink','Transport','Groceries','Utilities','Other'])[1 + floor(random() * 5)::int],
              'USD', ARRAY['t' || (i % 20)])
      RETURNING id INTO eid;

    SELECT array_agg(DISTINCT x) INTO picked FROM unnest(
      ARRAY[payer, uids[1 + floor(random() * 8)::int], uids[1 + floor(random() * 8)::int]]) x;
    n := array_length(picked, 1);
    share := round(amt / n, 2);
    INSERT INTO expense_splits (workspace_id, expense_id, user_id, amount_owed, amount_paid)
      SELECT ws, eid, x,
             CASE WHEN x = payer THEN amt - share * (n - 1) ELSE share END,
             CASE WHEN x = payer THEN amt ELSE 0 END
        FROM unnest(picked) x;
  END LOOP;

  -- A few payments between members, so settlements are part of every balance query.
  FOR i IN 1..200 LOOP
    INSERT INTO settlements (workspace_id, payer_id, payee_id, amount, currency, date)
      VALUES (ws, uids[1 + (i % 4)], uids[5 + (i % 4)], round((10 + random() * 40)::numeric, 2), 'USD',
              now() - (random() * 365 || ' days')::interval);
  END LOOP;
END $$;
