import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { parse } from 'csv-parse/sync';

import Group from '../src/groups/entities/group.entity';
import GroupCategory from '../src/groups/entities/groupCategory.entity';
import { Tenant } from '../src/tenants/entities/tenant.entity';
import { getConnection } from './db.connection';

type Row = {
  fob_name: string;
  location_name: string;
};

//const TENANT_ID = 6;
//const FOB_CATEGORY_ID = 2;
//const LOCATION_CATEGORY_ID = 3;

const TENANT_ID = 6;
const FOB_CATEGORY_ID = 59;
const LOCATION_CATEGORY_ID = 58;

function key(parentId: number | null | undefined, name: string) {
  return `${parentId ?? 0}::${name.trim().toLowerCase()}`;
}

async function main() {
  const csvPath =
    process.env.CSV_PATH || path.join(process.cwd(), 'fobs_locations.csv');
  if (!fs.existsSync(csvPath)) throw new Error(`CSV not found: ${csvPath}`);

  const csv = fs.readFileSync(csvPath, 'utf8');
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Row[];

  const connection = await getConnection();


  await connection.transaction(async(manager) => {
    const tenant = await manager.findOneByOrFail(Tenant, { id: TENANT_ID });

    const fobCategory = await manager.findOneByOrFail(GroupCategory, {
      id: FOB_CATEGORY_ID,
    });
    const locationCategory = await manager.findOneByOrFail(GroupCategory, {
      id: LOCATION_CATEGORY_ID,
    });

    // Load existing FOBs (tenant + category)
    const existingFobs = await manager.find(Group, {
      where: {
        tenant: { id: TENANT_ID },
        category: { id: FOB_CATEGORY_ID },
      },
      relations: ['tenant', 'category'],
    });

    const fobByName = new Map<string, Group>();
    for (const g of existingFobs) {
      fobByName.set(g.name.trim().toLowerCase(), g);
    }

    // Create missing FOBs
    const fobNames = Array.from(
      new Set(rows.map((r) => r.fob_name?.trim()).filter(Boolean)),
    ) as string[];

    for (const fobName of fobNames) {
      const k = fobName.toLowerCase();
      if (fobByName.has(k)) continue;

      const fob = manager.create(Group, {
        tenant,
        category: fobCategory,
        name: fobName,
        parentId: null, // FOB top-level
        // metaData: { type: 'FOB' },
      });

      const saved = await manager.save(fob);
      fobByName.set(k, saved);
    }

    // Load existing Locations (tenant + category) once
    const existingLocations = await manager.find(Group, {
      where: {
        tenant: { id: TENANT_ID },
        category: { id: LOCATION_CATEGORY_ID },
      },
      relations: ['tenant', 'category'],
    });

    // Key by parentId + name so duplicates under same FOB are avoided
    const locByKey = new Set<string>();
    for (const loc of existingLocations) {
      locByKey.add(key(loc.parentId, loc.name));
    }

    // Create Locations
    for (const r of rows) {
      const fobName = r.fob_name?.trim();
      const locName = r.location_name?.trim();
      if (!fobName || !locName) continue;

      const fob = fobByName.get(fobName.toLowerCase());
      if (!fob) continue;

      const k = key(fob.id, locName);
      if (locByKey.has(k)) continue;

      const loc = manager.create(Group, {
        tenant,
        category: locationCategory,
        name: locName,
        parentId: fob.id, // link location to FOB
        // address: { ... } // if you later add district/coords etc
        // metaData: { type: 'LOCATION' },
      });

      await manager.save(loc);
      locByKey.add(k);
    }
  });

  await connection.close();

  console.log('Import complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
