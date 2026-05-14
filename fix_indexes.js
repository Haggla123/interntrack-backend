/**
 * fix_indexes.js
 * ─────────────────────────────────────────────────────────────────
 * One-time migration: fixes two stale MongoDB indexes that cause
 * E11000 duplicate key errors in production.
 *
 * Problem 1 — grades collection:
 *   Old index `student_1` (single field) blocks a student having
 *   both an industrial AND an academic grade record.
 *   Fix: drop it, ensure compound `{ student: 1, type: 1 }` exists.
 *
 * Problem 2 — users collection:
 *   Old index `indexNumber_1` is NOT sparse, so every non-student
 *   user (admin, lecturer, industrial supervisor) whose indexNumber
 *   is null collides with each other on that null value.
 *   Same issue with `staffId_1`.
 *   Fix: drop them, recreate as sparse + unique so nulls are ignored.
 *
 * Run ONCE from your backend folder:
 *   node fix_indexes.js
 *
 * Safe to run on a live database — touches indexes only, not data.
 * ─────────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const mongoose = require('mongoose');

// ── Helper: print all indexes for a collection ───────────────────
const listIndexes = async (col) => {
  const idxs = await col.indexes();
  idxs.forEach(i => console.log(`    [${i.name}]  key: ${JSON.stringify(i.key)}  sparse: ${!!i.sparse}  unique: ${!!i.unique}`));
  return idxs;
};

// ── Helper: drop an index by name if it exists ───────────────────
const dropIfExists = async (col, name) => {
  try {
    await col.dropIndex(name);
    console.log(`    ✅  Dropped: ${name}`);
  } catch (e) {
    if (e.codeName === 'IndexNotFound' || e.code === 27) {
      console.log(`    ℹ️   Not found (already gone): ${name}`);
    } else {
      throw e;
    }
  }
};

const run = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI environment variable is required');
    }
    console.log('🔌  Connecting to MongoDB…');
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅  Connected to: ${mongoose.connection.host}\n`);

    const db = mongoose.connection.db;

    // ════════════════════════════════════════════════════════════
    // FIX 1 — grades collection
    // ════════════════════════════════════════════════════════════
    console.log('━━━━  grades collection  ━━━━');
    const grades = db.collection('grades');

    console.log('\n  Before:');
    const gradesBefore = await listIndexes(grades);

    console.log('\n  Dropping stale indexes…');
    await dropIfExists(grades, 'student_1');

    // Recreate correct compound index if missing
    const hasCompound = gradesBefore.some(
      i => i.key?.student === 1 && i.key?.type === 1
    );
    if (!hasCompound) {
      await grades.createIndex({ student: 1, type: 1 }, { unique: true, name: 'student_1_type_1' });
      console.log('    ✅  Created: { student: 1, type: 1 } unique');
    } else {
      console.log('    ✅  Compound index already present — skipped');
    }

    console.log('\n  After:');
    await listIndexes(grades);

    // ════════════════════════════════════════════════════════════
    // FIX 2 — users collection
    // ════════════════════════════════════════════════════════════
    console.log('\n━━━━  users collection  ━━━━');
    const users = db.collection('users');

    console.log('\n  Before:');
    const usersBefore = await listIndexes(users);

    console.log('\n  Dropping stale indexes…');
    // Drop old non-sparse versions
    await dropIfExists(users, 'indexNumber_1');
    await dropIfExists(users, 'staffId_1');

    // Recreate as sparse + unique so null values don't collide
    const hasIndexNumber = usersBefore.some(
      i => i.key?.indexNumber === 1 && i.sparse && i.unique
    );
    if (!hasIndexNumber) {
      await users.createIndex(
        { indexNumber: 1 },
        { unique: true, sparse: true, name: 'indexNumber_1_sparse' }
      );
      console.log('    ✅  Created: { indexNumber: 1 } unique + sparse');
    } else {
      console.log('    ✅  indexNumber sparse unique index already present — skipped');
    }

    const hasStaffId = usersBefore.some(
      i => i.key?.staffId === 1 && i.sparse && i.unique
    );
    if (!hasStaffId) {
      await users.createIndex(
        { staffId: 1 },
        { unique: true, sparse: true, name: 'staffId_1_sparse' }
      );
      console.log('    ✅  Created: { staffId: 1 } unique + sparse');
    } else {
      console.log('    ✅  staffId sparse unique index already present — skipped');
    }

    console.log('\n  After:');
    await listIndexes(users);

    // ════════════════════════════════════════════════════════════
    console.log('\n🎉  All migrations complete.');
    console.log('    You can now delete this file.\n');

  } catch (err) {
    console.error('\n❌  Migration failed:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌  Disconnected.\n');
  }
};

run();