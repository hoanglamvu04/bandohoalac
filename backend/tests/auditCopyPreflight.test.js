import test from 'node:test';
import assert from 'node:assert/strict';
import { AUDIT_COPY_ACK, verifyReadOnlyAuditCopy } from '../src/scripts/auditCopyPreflight.js';

const readonly = {
  read_only: true, privileged_role: false,
  can_create_db: false, can_create_public: false,
  can_mutate_tables: false, standby: false
};

test('audit preflight rejects without explicit independent copy acknowledgement before SQL', async () => {
  let called = 0;
  await assert.rejects(() => verifyReadOnlyAuditCopy({
    async query() { called++; return { rows: [readonly] }; }
  }, undefined), /AUDIT_COPY_NOT_CONFIRMED/);
  assert.equal(called, 0);
});

test('audit preflight returns metadata only for limited read-only account', async () => {
  let count = 0;
  const result = await verifyReadOnlyAuditCopy({
    async query(sql) {
      count++;
      assert.match(sql, /transaction_read_only/);
      assert.match(sql, /has_table_privilege/);
      assert.match(sql, /pg_is_in_recovery/);
      assert.doesNotMatch(sql, /INSERT INTO|UPDATE places|DELETE FROM/);
      return { rows: [readonly] };
    }
  }, AUDIT_COPY_ACK);
  assert.equal(count, 1);
  assert.equal(result.auditMode, 'COPY_READ_ONLY_VERIFIED');
  assert.equal(result.standby, false); // independent writable-copy with read-only role is allowed
  for (const secret of ['url','password','user','host','database']) {
    assert.equal(Object.hasOwn(result, secret), false);
  }
});

test('audit preflight fails closed for write privilege, elevated role, or nonread-only transaction', async () => {
  for (const col of ['read_only','privileged_role','can_create_db',
    'can_create_public','can_mutate_tables']) {
    const row = { ...readonly, [col]: col === 'read_only' ? false : true };
    await assert.rejects(() => verifyReadOnlyAuditCopy({
      async query() { return { rows: [row] }; }
    }, AUDIT_COPY_ACK), /AUDIT_ROLE_NOT_READ_ONLY/, col);
  }
  await assert.rejects(() => verifyReadOnlyAuditCopy({
    async query() { return { rows: [] }; }
  }, AUDIT_COPY_ACK), /AUDIT_ROLE_NOT_READ_ONLY/);
});

test('audit preflight can identify standby but never treat it as proof of separate backup', async () => {
  const result = await verifyReadOnlyAuditCopy({
    async query() { return { rows: [{ ...readonly, standby: true }] }; }
  }, AUDIT_COPY_ACK);
  assert.equal(result.standby, true);
  assert.equal(result.connection, 'OPERATOR_CONFIRMED_INDEPENDENT_COPY');
});
