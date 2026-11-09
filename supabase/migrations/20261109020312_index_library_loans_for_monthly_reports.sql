-- Supports the month range and ordering used by the loan exports and admin list.
CREATE INDEX IF NOT EXISTS library_loans_date_created_idx ON adminflow.library_loans (loan_date DESC, created_at DESC);
