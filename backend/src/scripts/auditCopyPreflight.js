// Guardrail for human-operated data audits. This cannot prove physical
// isolation: the operator must identify an independent PostgreSQL copy.
export const AUDIT_COPY_ACK = 'BAN_SAO_DOC_LAP_CHI_DOC';

const PREFLIGHT_SQL = `SELECT
  current_setting('transaction_read_only') = 'on' AS read_only,
  COALESCE((SELECT rolsuper OR rolcreatedb OR rolcreaterole
            FROM pg_roles WHERE rolname = current_user), TRUE) AS privileged_role,
  has_database_privilege(current_user, current_database(), 'CREATE') AS can_create_db,
  has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_public,
  EXISTS (
    SELECT 1
      FROM (VALUES ('places'), ('categories'), ('housing_listings'), ('place_images'))
           AS target(table_name)
     WHERE has_table_privilege(current_user, format('public.%I', target.table_name), 'INSERT')
        OR has_table_privilege(current_user, format('public.%I', target.table_name), 'UPDATE')
        OR has_table_privilege(current_user, format('public.%I', target.table_name), 'DELETE')
        OR has_table_privilege(current_user, format('public.%I', target.table_name), 'TRUNCATE')
  ) AS can_mutate_tables,
  pg_is_in_recovery() AS standby`;

function allowed(flag) {
  return flag === true || flag === 't';
}

export async function verifyReadOnlyAuditCopy(client, acknowledgement) {
  if (acknowledgement !== AUDIT_COPY_ACK) {
    throw new Error('AUDIT_COPY_NOT_CONFIRMED');
  }
  const result = await client.query(PREFLIGHT_SQL);
  const record = result?.rows?.[0];
  if (!record || !allowed(record.read_only) || allowed(record.privileged_role) ||
      allowed(record.can_create_db) || allowed(record.can_create_public) ||
      allowed(record.can_mutate_tables)) {
    throw new Error('AUDIT_ROLE_NOT_READ_ONLY');
  }
  // No DB name, address, username, connection URL or row data is returned.
  return {
    auditMode: 'COPY_READ_ONLY_VERIFIED',
    connection: 'OPERATOR_CONFIRMED_INDEPENDENT_COPY',
    standby: allowed(record.standby)
  };
}
