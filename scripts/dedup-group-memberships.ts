/**
 * Deduplicates group_membership rows so a UNIQUE(contactId, groupId) constraint
 * can be applied safely.
 *
 * Strategy per duplicate set:
 *   - Keep the row that is active (isActive = true), or the most recently joined
 *     one if all are inactive.
 *   - Delete the rest.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/dedup-group-memberships.ts
 *
 * Run against production ONLY after taking a backup.
 */

import { getConnection } from './db.connection';

interface DupRow {
  contact_id: number;
  group_id: number;
  ids: number[];
  active_ids: number[];
}

async function main() {
  const connection = await getConnection();
  const queryRunner = connection.createQueryRunner();

  try {
    // Find all (contactId, groupId) pairs that have more than one row
    const dupSets: DupRow[] = await queryRunner.query(`
      SELECT
        "contactId"          AS contact_id,
        "groupId"            AS group_id,
        array_agg(id ORDER BY "isActive" DESC, "joinedAt" DESC) AS ids,
        array_agg(id) FILTER (WHERE "isActive" = true)          AS active_ids
      FROM group_membership
      GROUP BY "contactId", "groupId"
      HAVING count(*) > 1
    `);

    if (dupSets.length === 0) {
      console.log('No duplicate group_membership rows found. Nothing to do.');
      return;
    }

    console.log(`Found ${dupSets.length} duplicate (contactId, groupId) sets.`);

    let totalDeleted = 0;

    await queryRunner.startTransaction();

    for (const dup of dupSets) {
      // ids is ordered: active rows first, then by most-recent joinedAt
      // Keep the first id, delete the rest
      const [keepId, ...deleteIds] = dup.ids;

      // If the kept row is inactive but there is an active duplicate, prefer
      // the active one (active_ids[0] is already first due to ORDER BY above,
      // but guard explicitly)
      const preferredKeepId =
        dup.active_ids && dup.active_ids.length > 0
          ? dup.active_ids[0]
          : keepId;

      const idsToDelete = dup.ids.filter((id) => id !== preferredKeepId);

      await queryRunner.query(
        'DELETE FROM group_membership WHERE id = ANY($1)',
        [idsToDelete],
      );

      console.log(
        `  contact=${dup.contact_id} group=${
          dup.group_id
        }: kept id=${preferredKeepId}, deleted ids=[${idsToDelete.join(', ')}]`,
      );

      totalDeleted += idsToDelete.length;
    }

    await queryRunner.commitTransaction();
    console.log(`\nDone. Deleted ${totalDeleted} duplicate rows.`);
    console.log(
      'You can now safely apply the UNIQUE(contactId, groupId) constraint.',
    );
  } catch (err) {
    await queryRunner.rollbackTransaction();
    console.error('Error during dedup — transaction rolled back:', err);
    process.exit(1);
  } finally {
    await queryRunner.release();
    await connection.close();
  }
}

//  ALTER TABLE group_membership ADD CONSTRAINT "UQ_group_membership_contact_group" UNIQUE ("contactId", "groupId");
main();
