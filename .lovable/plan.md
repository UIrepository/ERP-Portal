

# Fix: GraphQL Introspection Still Open for Anon

## Root Cause
The previous migration revoked permissions on `graphql_public`, but the actual GraphQL resolution function lives in the `graphql` schema. The `anon` role still has:
- `USAGE` on schema `graphql`
- `EXECUTE` on `graphql.resolve(text, jsonb, text, jsonb)`

## Fix
A single migration to revoke anon access to the GraphQL resolve function:

```sql
REVOKE ALL ON FUNCTION graphql.resolve(text, jsonb, text, jsonb) FROM anon;
REVOKE USAGE ON SCHEMA graphql FROM anon;
```

This prevents anonymous users from running any GraphQL queries (including introspection) while keeping it available for `authenticated` users.

## Impact
- Anonymous GraphQL introspection will be blocked
- Authenticated users retain full GraphQL access
- No frontend impact since the app uses the Supabase JS client (REST), not GraphQL

