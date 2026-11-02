-- Homes: a shared household.
CREATE TABLE homes (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Members: people in a home. `position` records the order they were added,
-- which decides who receives the extra cents when a bill does not split evenly.
CREATE TABLE members (
  id         TEXT PRIMARY KEY,
  home_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  position   INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  CONSTRAINT fk_members_home
    FOREIGN KEY (home_id) REFERENCES homes (id) ON DELETE CASCADE,
  -- Two members of one home can never hold the same position.
  CONSTRAINT uq_members_home_position UNIQUE (home_id, position)
);

-- Bills: one expense for a home.
CREATE TABLE bills (
  id          TEXT PRIMARY KEY,
  home_id     TEXT NOT NULL,
  title       TEXT NOT NULL,
  total_cents INTEGER NOT NULL,
  created_at  TEXT NOT NULL,
  CONSTRAINT fk_bills_home
    FOREIGN KEY (home_id) REFERENCES homes (id) ON DELETE CASCADE,
  -- A bill must be for a positive whole number of cents.
  CONSTRAINT ck_bills_total_positive CHECK (total_cents > 0)
);

-- Shares: one member's part of one bill.
CREATE TABLE shares (
  id              TEXT PRIMARY KEY,
  bill_id         TEXT NOT NULL,
  member_id       TEXT NOT NULL,
  amount_cents    INTEGER NOT NULL,
  paid_at         TEXT,
  idempotency_key TEXT,
  CONSTRAINT fk_shares_bill
    FOREIGN KEY (bill_id) REFERENCES bills (id) ON DELETE CASCADE,
  CONSTRAINT fk_shares_member
    FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE,
  -- A member has exactly one share per bill.
  CONSTRAINT uq_shares_bill_member UNIQUE (bill_id, member_id),
  CONSTRAINT ck_shares_amount_not_negative CHECK (amount_cents >= 0),
  -- A share is either unpaid (no time, no key) or paid (both set). Never half.
  CONSTRAINT ck_shares_paid_state CHECK ((paid_at IS NULL) = (idempotency_key IS NULL))
);

CREATE INDEX idx_members_home ON members (home_id, position);
CREATE INDEX idx_bills_home ON bills (home_id, created_at);
CREATE INDEX idx_shares_bill ON shares (bill_id);
CREATE INDEX idx_shares_member ON shares (member_id);
