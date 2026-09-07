-- Fixes a real regression: 20260906150000_student_self_registration
-- deliberately left `companies_system_admin_only` unwidened, reasoning that
-- "registration never reads it directly" — true at the time, since roles
-- were still per-company then, so AuthService.registerStudent could prove a
-- submitted company_id was real indirectly, by requiring its 'student' role
-- to resolve (a bogus company_id had no such row). The LATER global-roles
-- migration (20260907170000_global_roles) removed that indirect proof —
-- 'student' now always resolves regardless of company_id — so
-- registerStudent was updated to an explicit
-- `tx.company.findFirst({ where: { id: dto.company_id, isDeleted: false } })`
-- check instead. That explicit read runs under PRE_AUTH_CONTEXT (system
-- actor 'auth_service', no app.current_role of 'system_admin'), which the
-- unwidened policy silently filters to zero rows — so every registration
-- attempt failed with "Invalid company" regardless of whether the company_id
-- was actually valid. Widened here with the exact same auth_service
-- system-actor bypass every other pre-auth registration read already uses
-- (categories_tenant_isolation/departments_tenant_isolation, same
-- migration). Read-only in practice — registerStudent never writes to
-- companies — but this is a `FOR ALL` policy (matching 001's own single-
-- policy shape for this table), so the WITH CHECK clause is widened too for
-- consistency, even though no INSERT/UPDATE path via this actor exists.

DROP POLICY "companies_system_admin_only" ON "companies";
CREATE POLICY "companies_system_admin_only" ON "companies"
  FOR ALL
  USING (
    current_setting('app.current_role', true) = 'system_admin'
    OR current_setting('app.current_system_actor', true) = 'auth_service'
  )
  WITH CHECK (
    current_setting('app.current_role', true) = 'system_admin'
    OR current_setting('app.current_system_actor', true) = 'auth_service'
  );
