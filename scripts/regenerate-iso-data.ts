/**
 * One-shot ISO 3166-1 alpha-2 reference data generator.
 *
 * Run with `world-countries` installed transiently:
 *   npm install --no-save world-countries
 *   npx ts-node scripts/regenerate-iso-data.ts
 *   npm uninstall world-countries  # confirm package.json untouched
 *
 * Output: prisma/data/countries-iso3166.json — 250 entries (sovereign +
 * dependent territories with an ISO 3166-1 alpha-2 code).
 *
 * The repo does NOT depend on world-countries at runtime. The dump is
 * audited and committed as static data so seed runs are deterministic
 * and the security surface is one JSON file, not a transitive dep tree.
 */
import * as fs from 'fs';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const worldCountries: any[] = require('world-countries');

type ContinentCode = 'AF' | 'AS' | 'EU' | 'NA' | 'SA' | 'OC' | 'AN';

interface CountryReference {
  isoCode: string; // ISO 3166-1 alpha-2
  name: string;
  flagEmoji: string;
  continentCode: ContinentCode;
  region: string; // UN M49 subregion
}

/**
 * Map world-countries `region` (UN broad region) + `subregion` (UN M49) to a
 * compact 7-value continent code suited to dropdown filters.
 *
 * The Americas region is split into NA / SA via subregion because UI dropdowns
 * are easier to filter at the continent grain.
 */
function continentCodeFor(region: string, subregion: string): ContinentCode {
  switch (region) {
    case 'Africa':
      return 'AF';
    case 'Asia':
      return 'AS';
    case 'Europe':
      return 'EU';
    case 'Oceania':
      return 'OC';
    case 'Antarctic':
      return 'AN';
    case 'Americas':
      // world-countries uses 'North America' (USA, Canada, Mexico, Greenland,
      // Bermuda, etc.) for the northern continental block. Central America,
      // South America, and Caribbean all roll into SA for our continent
      // dropdown grain.
      if (subregion === 'North America') return 'NA';
      return 'SA';
    default:
      // Some entries (e.g. Antarctica subdivisions) have empty region.
      // Default to AN per UN convention; specific entries can be overridden.
      return 'AN';
  }
}

/**
 * Manual overrides for cases where world-countries is stale, ambiguous, or
 * a name change has not yet propagated to the package version pinned in
 * the repo. Verified by hand. Keep this map small and audited.
 */
const NAME_OVERRIDES: Record<string, string> = {
  // TR was renamed at the UN in 2022; some package versions still ship "Turkey".
  TR: 'Türkiye',
};

const CONTINENT_OVERRIDES: Record<string, ContinentCode> = {
  // Russia spans Europe and Asia; world-countries reports "Europe" as primary.
  // We follow that. No override needed today.
  // TR is also trans-continental but primary listing is Asia per ISO and UN.
  // Leave this map for future surprises; document each entry's reason.
};

function dump(): CountryReference[] {
  const out: CountryReference[] = [];
  for (const c of worldCountries) {
    const isoCode: string = c.cca2;
    if (!isoCode || isoCode.length !== 2) continue;

    const name: string = NAME_OVERRIDES[isoCode] ?? c.name?.common ?? isoCode;
    const flagEmoji: string = c.flag ?? '';
    const region: string = c.region ?? '';
    const subregion: string = c.subregion ?? '';
    const continentCode: ContinentCode =
      CONTINENT_OVERRIDES[isoCode] ?? continentCodeFor(region, subregion);

    out.push({
      isoCode,
      name,
      flagEmoji,
      continentCode,
      region: subregion || region || 'Unknown',
    });
  }

  // Stable sort by isoCode for deterministic file diffs.
  out.sort((a, b) => a.isoCode.localeCompare(b.isoCode));
  return out;
}

function main() {
  const data = dump();
  const outPath = path.resolve(__dirname, '..', 'prisma', 'data', 'countries-iso3166.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n', 'utf8');

  // Per-continent breakdown for sanity.
  const byContinent: Record<string, number> = {};
  for (const c of data) {
    byContinent[c.continentCode] = (byContinent[c.continentCode] ?? 0) + 1;
  }

  console.log(`✅ Wrote ${data.length} countries to ${outPath}`);
  console.log('Per-continent breakdown:');
  for (const [code, count] of Object.entries(byContinent).sort()) {
    console.log(`  ${code}: ${count}`);
  }
  // Spot-check the 3 currently seeded production countries.
  for (const iso of ['TR', 'AZ', 'AE']) {
    const row = data.find((d) => d.isoCode === iso);
    console.log(`  spot ${iso}: ${row ? JSON.stringify(row) : 'MISSING'}`);
  }
}

main();
