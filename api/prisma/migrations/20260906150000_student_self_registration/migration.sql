-- specs/001-company-role-user-setup's own `POST /auth/register` endpoint
-- (contracts/openapi.yaml) is implemented by this change. No schema change —
-- only an RLS widening, in the same spirit as
-- 20260906000000_auth_sessions's widening of `users_tenant_isolation` and
-- `roles_select` for the identical "pre-authentication lookup" need: a
-- prospective Student registering has no JWT yet, so no
-- app.current_company_id is set when AuthService.registerStudent needs to
-- validate that the submitted category_id/department_id actually belong to
-- the target company. Reusing the same auth_service system-actor identity
-- (coding_standard.md §4.3) rather than a general RLS bypass — used for this
-- one pre-auth validation read only; every other access to these tables
-- keeps going through a real user's own tenant context. `companies` is
-- deliberately NOT widened here: registration never reads it directly, only
-- the role/category/department rows scoped to the submitted company_id, so
-- companies_system_admin_only (FR-016) is left exactly as strict as 001 set it.

DROP POLICY "categories_tenant_isolation" ON "categories";
CREATE POLICY "categories_tenant_isolation" ON "categories"
  FOR ALL
  USING (
    "company_id" = NULLIF(current_setting('app.current_company_id', true), '')::uuid
    OR current_setting('app.current_role', true) = 'system_admin'
    OR current_setting('app.current_system_actor', true) = 'auth_service'
  )
  WITH CHECK (
    "company_id" = NULLIF(current_setting('app.current_company_id', true), '')::uuid
    OR current_setting('app.current_role', true) = 'system_admin'
    OR current_setting('app.current_system_actor', true) = 'auth_service'
  );

DROP POLICY "departments_tenant_isolation" ON "departments";
CREATE POLICY "departments_tenant_isolation" ON "departments"
  FOR ALL
  USING (
    "company_id" = NULLIF(current_setting('app.current_company_id', true), '')::uuid
    OR current_setting('app.current_role', true) = 'system_admin'
    OR current_setting('app.current_system_actor', true) = 'auth_service'
  )
  WITH CHECK (
    "company_id" = NULLIF(current_setting('app.current_company_id', true), '')::uuid
    OR current_setting('app.current_role', true) = 'system_admin'
    OR current_setting('app.current_system_actor', true) = 'auth_service'
  );
