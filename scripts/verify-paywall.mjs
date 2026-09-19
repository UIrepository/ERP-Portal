/**
 * Paywall regression check.
 *
 *   node scripts/verify-paywall.mjs <catalog_id> [access_token]
 *
 * Asserts that resolve-content refuses every unauthenticated route to a piece
 * of content. Run it after touching the catalog, the resolver, the entitlement
 * function or the RLS on any content table — and in CI before a deploy.
 *
 * It only ever asserts DENIALS, so it is safe to run against production with no
 * credentials at all. Pass a real access token as the second argument to also
 * check that a signed-in non-buyer is refused.
 *
 * Exit code 0 = the paywall holds. Non-zero = something is open that should not
 * be; the output names which case failed.
 */

const ERP =
  process.env.ERP_FUNCTIONS_URL ??
  'https://lcfzfdjeidinenxcucvj.supabase.co/functions/v1';

const catalogId = process.argv[2];
const token = process.argv[3];

if (!catalogId) {
  console.error('usage: node scripts/verify-paywall.mjs <catalog_id> [access_token]');
  process.exit(2);
}

/** Every one of these MUST be refused. A 200 from any of them is a breach. */
const cases = [
  { name: 'no credentials',              headers: {} },
  { name: 'garbage bearer token',        headers: { Authorization: 'Bearer not.a.real.token' } },
  { name: 'forged email header',         headers: { 'x-viewer-email': 'someone@example.com' } },
  { name: 'forged email + wrong secret', headers: { 'x-bridge-secret': 'wrong', 'x-viewer-email': 'someone@example.com' } },
  { name: 'empty bearer',                headers: { Authorization: 'Bearer ' } },
];

if (token) {
  cases.push({ name: 'signed-in non-buyer', headers: { Authorization: `Bearer ${token}` } });
  cases.push({
    name: 'non-buyer token + forged email',
    headers: { Authorization: `Bearer ${token}`, 'x-viewer-email': 'someone@example.com' },
  });
}

let failures = 0;

for (const c of cases) {
  let status, body;
  try {
    const res = await fetch(`${ERP}/resolve-content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...c.headers },
      body: JSON.stringify({ catalog_id: catalogId }),
    });
    status = res.status;
    body = await res.json().catch(() => ({}));
  } catch (err) {
    console.error(`  ERROR  ${c.name}: ${err.message}`);
    failures++;
    continue;
  }

  // A denial must carry no URL and must not report allowed.
  const leaked = body?.allowed === true || typeof body?.url === 'string';
  if (leaked) {
    console.error(`  BREACH ${c.name}: [${status}] returned content`);
    failures++;
  } else {
    console.log(`  ok     ${c.name}: [${status}] ${body?.reason ?? 'denied'}`);
  }
}

// The public catalog must never carry an address either.
const batchRes = await fetch(`${ERP}/public-catalog?batch=${encodeURIComponent(process.env.CHECK_BATCH ?? 'Diploma - Quiz 1')}`);
const catalog = await batchRes.json().catch(() => ({}));
const urls = JSON.stringify(catalog).match(/https?:\/\/[^"\s]+/g);
if (urls) {
  console.error(`  BREACH public catalog contains ${urls.length} URL(s): ${urls.slice(0, 3).join(', ')}`);
  failures++;
} else {
  console.log('  ok     public catalog carries no URLs');
}

if (failures) {
  console.error(`\n${failures} check(s) failed — the paywall is NOT holding.`);
  process.exit(1);
}
console.log('\nAll checks passed — content is refused on every unauthenticated route.');
