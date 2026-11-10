<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Supabase only (pgsql). Laravel connects as `postgres` (bypasses RLS); RLS protects the tables from the
 * browser-exposed anon key (PostgREST/Realtime). Only touches the app's own schema (DB_SCHEMA), never other
 * schemas in a shared project. Every table in it gets RLS (no policy = no access); org-scoped tables get a
 * read policy keyed on the `org_id` claim of the JWT minted by /realtime-token.
 */
return new class extends Migration
{
    private array $orgTables = ['transaction_categories', 'user_rules', 'transactions', 'savings', 'bills', 'whatsapp_connections', 'memberships', 'subscriptions'];

    private array $realtime = ['transactions', 'savings', 'bills'];

    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }
        $s = DB::selectOne('SELECT current_schema() AS s')->s;
        DB::unprepared(<<<SQL
CREATE OR REPLACE FUNCTION "$s".get_org_id() RETURNS BIGINT AS \$\$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'org_id', '')::BIGINT;
\$\$ LANGUAGE sql STABLE;
SQL);
        foreach (DB::select('SELECT tablename FROM pg_tables WHERE schemaname = ?', [$s]) as $t) {
            DB::statement("ALTER TABLE \"$s\".\"{$t->tablename}\" ENABLE ROW LEVEL SECURITY");
        }
        foreach ($this->orgTables as $t) {
            DB::statement("DROP POLICY IF EXISTS org_isolation ON \"$s\".$t");
            DB::statement("CREATE POLICY org_isolation ON \"$s\".$t FOR SELECT TO authenticated USING (organization_id = \"$s\".get_org_id())");
        }
        // Realtime evaluates RLS as `authenticated`, which needs schema + table privileges outside `public`.
        DB::statement("GRANT USAGE ON SCHEMA \"$s\" TO authenticated");
        DB::statement("GRANT EXECUTE ON FUNCTION \"$s\".get_org_id() TO authenticated");
        foreach ($this->realtime as $t) {
            DB::statement("GRANT SELECT ON \"$s\".$t TO authenticated");
        }
        if (DB::selectOne("SELECT 1 AS x FROM pg_publication WHERE pubname = 'supabase_realtime'")) {
            foreach ($this->realtime as $t) {
                $already = DB::selectOne('SELECT 1 AS x FROM pg_publication_tables WHERE pubname = ? AND schemaname = ? AND tablename = ?', ['supabase_realtime', $s, $t]);
                if (! $already) {
                    DB::statement("ALTER PUBLICATION supabase_realtime ADD TABLE \"$s\".$t");
                }
            }
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }
        $s = DB::selectOne('SELECT current_schema() AS s')->s;
        foreach ($this->orgTables as $t) {
            DB::statement("DROP POLICY IF EXISTS org_isolation ON \"$s\".$t");
        }
    }
};
