-- Wallet-based authentication (Sign In With Stellar / SEP-53).
-- Each end user is identified by their Stellar public key. The API maps the
-- wallet address to a users row and issues a session JWT after verifying a
-- signed challenge. Address is nullable (legacy/email users have none) + unique.
alter table public.users add column if not exists wallet_address text;
create unique index if not exists uq_users_wallet_address
  on public.users (wallet_address) where wallet_address is not null;
