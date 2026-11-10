#!/data/data/com.termux/files/usr/bin/bash
set -Eeuo pipefail

ROOT="$HOME/gpu-phase914"
DATA="$ROOT/pgdata"
SOCKET="$ROOT/socket"
BACKUP="$ROOT/phase928.backup"
DB="gpu_phase930b_test"
STARTED=0
CREATED=0

cd "$HOME/gpu-phase911-work"

test "$(git branch --show-current)" = \
  "security/phase911-migration-preflight"

test -z "$(git status --porcelain)" || {
  echo "FAIL: Working tree not clean"
  exit 1
}

test -s "$BACKUP"

unset DATABASE_URL DIRECT_URL SUPABASE_DB_URL POSTGRES_URL
unset PGHOSTADDR PGSERVICE PGSERVICEFILE PGOPTIONS
unset DB_MIGRATION_EXECUTE DB_MIGRATION_TARGET
unset DB_MIGRATION_TARGET_CONFIRM
unset DB_MIGRATION_EXPECT_SERVER_ADDRESS

export NODE_ENV=test
export SYSTEM_OPERATING_MODE=simulation
export DISABLE_JSON_PERSISTENCE=true
export PGHOST="$SOCKET"
export PGPORT=55432
export PGDATABASE=postgres

cleanup() {
  unset DATABASE_URL DB_MIGRATION_EXECUTE
  export PGDATABASE=postgres

  if [ "$CREATED" -eq 1 ]; then
    dropdb --if-exists "$DB" || true
  fi

  if [ "$STARTED" -eq 1 ]; then
    pg_ctl -D "$DATA" stop -m fast || true
  fi
}

trap cleanup EXIT

pg_ctl -D "$DATA" \
  -l "$ROOT/postgres.log" \
  -o "-p 55432 -k $SOCKET -c listen_addresses=''" \
  start

STARTED=1

echo "=== VERIFY ISOLATED POSTGRESQL ==="

test "$(psql -X -At -v ON_ERROR_STOP=1 -c \
  "SELECT inet_server_addr() IS NULL
   AND current_database() = 'postgres'
   AND current_setting('port') = '55432'")" = "t"

test "$(psql -X -At -v ON_ERROR_STOP=1 -c \
  "SELECT count(*) FROM pg_database
   WHERE datname='$DB'")" = "0" || {
  echo "FAIL: Disposable database already exists"
  exit 1
}

createdb "$DB"
CREATED=1

echo "=== RESTORE BACKUP ==="

pg_restore --exit-on-error --single-transaction \
  --no-owner --no-privileges \
  -d "$DB" "$BACKUP"

export PGDATABASE="$DB"

test "$(psql -X -At -v ON_ERROR_STOP=1 -c \
  'SELECT count(*) FROM schema_migrations')" = "8"

echo "PASS: Eight migrations restored"

echo "=== ACTUAL FINANCIAL CONSTRAINT TESTS ==="

psql -X -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

CREATE TEMP TABLE t_payment
(LIKE public.payment_intents
 INCLUDING DEFAULTS INCLUDING CONSTRAINTS);

CREATE TEMP TABLE t_reservation
(LIKE public.capital_reservations
 INCLUDING DEFAULTS INCLUDING CONSTRAINTS);

CREATE TEMP TABLE t_ledger
(LIKE public.treasury_ledger
 INCLUDING DEFAULTS INCLUDING CONSTRAINTS);

CREATE TEMP TABLE t_funding
(LIKE public.provider_funding_events
 INCLUDING DEFAULTS INCLUDING CONSTRAINTS);

CREATE TEMP TABLE t_profit
(LIKE public.withdrawable_profits
 INCLUDING DEFAULTS INCLUDING CONSTRAINTS);

INSERT INTO t_payment
(id, customer_id, provider, amount_minor)
VALUES ('test-payment', 'customer', 'test', 100);

INSERT INTO t_reservation
(reservation_id, demand_order_id, quote_id,
 account_id, asset, currency, amount, expires_at)
VALUES
('test-reservation', 'demand', 'quote',
 'account', 'USD', 'USD', 100, now() + interval '1 day');

INSERT INTO t_ledger
(transaction_id, entry_group_id, account_id,
 asset, currency, quantity, "precision", direction,
 transaction_type, external_reference, provider,
 previous_hash, record_hash)
VALUES
('test-transaction', 'test-group', 'account',
 'USD', 'USD', 100, 2, 'DEBIT',
 'TEST', 'test-reference', 'test',
 'previous', 'current');

INSERT INTO t_funding
(id, provider, amount, currency,
 external_transaction_reference, provider_account_id,
 status, audit_hash)
VALUES
('test-funding', 'test', 100, 'USD',
 'test-external', 'test-account',
 'PENDING', 'test-hash');

INSERT INTO t_profit
(id, settlement_id, job_id, customer_id,
 gross_revenue_minor, provider_cost_minor,
 net_profit_minor, net_profit_usd)
VALUES
('test-profit', 'settlement', 'job', 'customer',
 1000, 500, 500, 5.00);

DO $$
DECLARE
  t record;
  actual text;
  passed integer := 0;
BEGIN
  FOR t IN
    SELECT *
    FROM (VALUES
      ('t_payment', 'status',
       'INVALID_STATUS',
       ARRAY['payment_intents_status_check']),

      ('t_payment', 'amount_minor',
       '-100',
       ARRAY['payment_intents_amount_minor_check']),

      ('t_reservation', 'status',
       'INVALID_STATUS',
       ARRAY['chk_res_status']),

      ('t_reservation', 'amount',
       '-100',
       ARRAY['chk_positive_res_amount',
             'capital_reservations_amount_check']),

      ('t_ledger', 'direction',
       'INVALID',
       ARRAY['chk_valid_direction',
             'treasury_ledger_direction_check']),

      ('t_ledger', 'quantity',
       '-100',
       ARRAY['chk_positive_quantity',
             'treasury_ledger_quantity_check']),

      ('t_ledger', 'precision',
       '99',
       ARRAY['chk_valid_precision',
             'treasury_ledger_precision_check']),

      ('t_funding', 'status',
       'INVALID_STATUS',
       ARRAY['provider_funding_events_status_check']),

      ('t_funding', 'amount',
       '-100',
       ARRAY['provider_funding_events_amount_check']),

      ('t_profit', 'net_profit_minor',
       '-100',
       ARRAY['withdrawable_profits_net_profit_minor_check']),

      ('t_profit', 'status',
       'INVALID_STATUS',
       ARRAY['withdrawable_profits_status_check'])
    ) AS tests(tbl, col, val, expected)
  LOOP
    BEGIN
      EXECUTE format(
        'UPDATE pg_temp.%I SET %I = %L',
        t.tbl, t.col, t.val
      );

      RAISE EXCEPTION
        'FAIL: Invalid value accepted for %.%',
        t.tbl, t.col;

    EXCEPTION
      WHEN check_violation THEN
        GET STACKED DIAGNOSTICS
          actual = CONSTRAINT_NAME;

        IF NOT (actual = ANY(t.expected)) THEN
          RAISE EXCEPTION
            'FAIL: Unexpected constraint % for %.%',
            actual, t.tbl, t.col;
        END IF;

        passed := passed + 1;
        RAISE NOTICE
          'PASS %: %.% rejected by %',
          passed, t.tbl, t.col, actual;
    END;
  END LOOP;

  IF passed <> 11 THEN
    RAISE EXCEPTION
      'Expected 11 rejections, received %',
      passed;
  END IF;

  RAISE NOTICE
    'PASS: All 11 financial constraint tests';
END
$$;

ROLLBACK;
SQL

echo "======================================"
echo "PHASE 9.30B: 11 TESTS PASSED"
echo "======================================"
echo "Original constraint definitions tested"
echo "All test transactions rolled back"
echo "No production changes"
