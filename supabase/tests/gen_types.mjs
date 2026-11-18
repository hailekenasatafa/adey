/**
 * Generates packages/shared/src/database.types.ts from a live database connection
 * (the in-process validation database started by run_local.mjs --types).
 *
 * The output has the same shape as `supabase gen types typescript`:
 * Database["public"] { Tables, Views, Functions, Enums, CompositeTypes } plus the
 * Tables / TablesInsert / TablesUpdate / Enums / CompositeTypes helpers. After the
 * migrations are applied to a real project, `pnpm db:types` produces an equivalent file.
 */

const SCALARS = {
  bool: 'boolean',
  int2: 'number', int4: 'number', int8: 'number', float4: 'number', float8: 'number', numeric: 'number', oid: 'number',
  text: 'string', varchar: 'string', bpchar: 'string', citext: 'string', name: 'string', uuid: 'string',
  date: 'string', time: 'string', timetz: 'string', timestamp: 'string', timestamptz: 'string', interval: 'string',
  bytea: 'string', inet: 'string', cidr: 'string', macaddr: 'string',
  json: 'Json', jsonb: 'Json',
  void: 'undefined', record: 'Record<string, unknown>',
};

const key = (name) => JSON.stringify(name);
const SCHEMA = 'Database["public"]';

export async function generateTypes(db) {
  const rows = async (sql, params = []) => (await db.query(sql, params)).rows;

  // ---------------------------------------------------------------- catalog
  const types = new Map();
  for (const t of await rows(`
    select t.oid::int as oid, t.typname, t.typtype, t.typcategory, t.typelem::int as typelem, t.typbasetype::int as typbasetype,
           t.typrelid::int as typrelid, n.nspname, c.relkind
      from pg_type t join pg_namespace n on n.oid = t.typnamespace left join pg_class c on c.oid = t.typrelid`)) types.set(t.oid, t);

  const enums = await rows(`
    select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder) as labels
      from pg_type t join pg_namespace n on n.oid = t.typnamespace join pg_enum e on e.enumtypid = t.oid
     where n.nspname = 'public' group by t.typname order by t.typname`);

  const relations = await rows(`
    select c.oid::int as oid, c.relname as name, c.relkind
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'c') order by c.relname`);
  const relByOid = new Map(relations.map((r) => [r.oid, r]));

  const columns = await rows(`
    select a.attrelid::int as relid, a.attname as name, a.attnum, a.attnotnull, a.atthasdef, a.attidentity, a.attgenerated, a.atttypid::int as typid
      from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and a.attnum > 0 and not a.attisdropped order by a.attrelid, a.attnum`);
  const colsByRel = new Map();
  for (const c of columns) colsByRel.set(c.relid, [...(colsByRel.get(c.relid) ?? []), c]);

  const fks = await rows(`
    select con.conname as name, con.conrelid::int as relid, con.confrelid::int as frelid,
           (select array_agg(a.attname order by k.ord) from unnest(con.conkey) with ordinality k(attnum, ord) join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum) as cols,
           (select array_agg(a.attname order by k.ord) from unnest(con.confkey) with ordinality k(attnum, ord) join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.attnum) as fcols,
           exists (select 1 from pg_constraint u where u.conrelid = con.conrelid and u.contype in ('p', 'u')
                     and (select array_agg(x order by x) from unnest(u.conkey) x) = (select array_agg(x order by x) from unnest(con.conkey) x)) as one_to_one
      from pg_constraint con join pg_namespace n on n.oid = con.connamespace
     where con.contype = 'f' and n.nspname = 'public' order by con.conname`);

  // views -> the tables they select from (used for view nullability and for relationships through views)
  const viewDeps = await rows(`
    select distinct r.ev_class::int as view_oid, d.refobjid::int as table_oid
      from pg_rewrite r join pg_depend d on d.objid = r.oid and d.classid = 'pg_rewrite'::regclass
     where d.refclassid = 'pg_class'::regclass and d.refobjid <> r.ev_class and d.deptype = 'n'`);
  const viewBases = new Map();
  for (const v of viewDeps) viewBases.set(v.view_oid, [...(viewBases.get(v.view_oid) ?? []), v.table_oid]);

  const functions = await rows(`
    select p.oid::int as oid, p.proname as name, p.proretset as retset, p.prorettype::int as rettype, p.pronargdefaults as ndefaults,
           coalesce(p.proargnames, '{}') as argnames, coalesce(p.proargmodes::text[], '{}') as argmodes,
           coalesce(p.proallargtypes::int[], p.proargtypes::int[]) as argtypes
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
     order by p.proname, p.oid`);

  // ---------------------------------------------------------------- type mapping
  const rowType = (relid, { nonNull = false } = {}) => {
    const cols = [...(colsByRel.get(relid) ?? [])].sort((a, b) => (a.name < b.name ? -1 : 1));
    return `{ ${cols.map((c) => `${key(c.name)}: ${tsType(c.typid, { json: c.attnotnull ? 'NonNullable<Json>' : 'Json' })}${c.attnotnull || nonNull ? '' : ' | null'}`).join('; ')} }`;
  };

  function tsType(oid, { json = 'Json' } = {}) {
    const t = types.get(oid);
    if (!t) return 'unknown';
    if (t.typcategory === 'A' && t.typelem) return `(${tsType(t.typelem)})[]`;
    if (t.typtype === 'd') return tsType(t.typbasetype, { json });
    if (t.typtype === 'e') return t.nspname === 'public' ? `${SCHEMA}["Enums"][${key(t.typname)}]` : 'string';
    if (t.typtype === 'c') {
      if (t.nspname !== 'public') return 'Record<string, unknown>';
      return t.relkind === 'c' ? `${SCHEMA}["CompositeTypes"][${key(t.typname)}]` : `${SCHEMA}["Tables"][${key(t.typname)}]["Row"]`;
    }
    const scalar = SCALARS[t.typname];
    if (scalar === 'Json') return json;
    return scalar ?? 'unknown';
  }
  const columnType = (c) => tsType(c.typid, { json: c.attnotnull ? 'NonNullable<Json>' : 'Json' });

  // ---------------------------------------------------------------- tables
  const tableBlock = (rel) => {
    const cols = [...(colsByRel.get(rel.oid) ?? [])].sort((a, b) => (a.name < b.name ? -1 : 1));
    const isView = rel.relkind === 'v' || rel.relkind === 'm';
    // a view column is non-null when the single table underneath has a NOT NULL column of the same name
    const bases = viewBases.get(rel.oid) ?? [];
    const baseCols = isView && bases.length === 1 ? new Map((colsByRel.get(bases[0]) ?? []).map((c) => [c.name, c])) : new Map();
    const notNull = (c) => (isView ? !!baseCols.get(c.name)?.attnotnull : c.attnotnull);

    const row = cols.map((c) => `${key(c.name)}: ${tsType(c.typid, { json: notNull(c) ? 'NonNullable<Json>' : 'Json' })}${notNull(c) ? '' : ' | null'}`);
    const insert = cols.map((c) => {
      if (isView) return `${key(c.name)}?: ${tsType(c.typid)} | null`;
      if (c.attidentity === 'a' || c.attgenerated !== '') return `${key(c.name)}?: never`;
      const optional = !c.attnotnull || c.atthasdef || c.attidentity === 'd';
      return `${key(c.name)}${optional ? '?' : ''}: ${columnType(c)}${c.attnotnull ? '' : ' | null'}`;
    });
    const update = cols.map((c) => {
      if (isView) return `${key(c.name)}?: ${tsType(c.typid)} | null`;
      if (c.attidentity === 'a' || c.attgenerated !== '') return `${key(c.name)}?: never`;
      return `${key(c.name)}?: ${columnType(c)}${c.attnotnull ? '' : ' | null'}`;
    });

    // relationships: this table's foreign keys, each also offered through any view that wraps the referenced table
    const rels = [];
    const ownFks = isView
      ? fks.filter((f) => bases.length === 1 && f.relid === bases[0] && f.cols.every((c) => cols.some((x) => x.name === c)))
      : fks.filter((f) => f.relid === rel.oid);
    for (const f of ownFks) {
      const target = relByOid.get(f.frelid);
      if (!target) continue; // references another schema (auth.users …)
      rels.push({ name: f.name, cols: f.cols, one: f.one_to_one, to: target.name, fcols: f.fcols, order: 0 });
      for (const [viewOid, tables] of viewBases) {
        const view = relByOid.get(viewOid);
        if (!view || tables.length !== 1 || tables[0] !== f.frelid) continue;
        const viewCols = new Set((colsByRel.get(viewOid) ?? []).map((c) => c.name));
        if (f.fcols.every((c) => viewCols.has(c))) rels.push({ name: f.name, cols: f.cols, one: f.one_to_one, to: view.name, fcols: f.fcols, order: 1 });
      }
    }
    rels.sort((a, b) => (a.name !== b.name ? (a.name < b.name ? -1 : 1) : a.order !== b.order ? a.order - b.order : a.to < b.to ? -1 : 1));
    const relText = rels.map((r) => `          {
            foreignKeyName: ${key(r.name)}
            columns: [${r.cols.map(key).join(', ')}]
            isOneToOne: ${r.one}
            referencedRelation: ${key(r.to)}
            referencedColumns: [${r.fcols.map(key).join(', ')}]
          }`);

    return `      ${key(rel.name)}: {
        Row: {
          ${row.join('\n          ')}
        }
        ComputedFields: never
        Insert: {
          ${insert.join('\n          ')}
        }
        Update: {
          ${update.join('\n          ')}
        }
        Relationships: [${relText.length ? '\n' + relText.join(',\n') + '\n        ' : ''}]
      }`;
  };

  // ---------------------------------------------------------------- functions
  const fnSignature = (f) => {
    const modes = f.argmodes.length ? f.argmodes : f.argtypes.map(() => 'i');
    const inputs = [];
    const tableCols = [];
    f.argtypes.forEach((typid, i) => {
      const mode = modes[i];
      const name = f.argnames[i] ?? '';
      if (mode === 'i' || mode === 'b' || mode === 'v') inputs.push({ name, typid });
      if (mode === 't' || mode === 'o') tableCols.push({ name, typid });
    });
    const firstDefault = inputs.length - f.ndefaults;
    const args = inputs.map((a, i) => ({ ...a, optional: i >= firstDefault })).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const argsText = args.length
      ? `{ ${args.map((a) => `${key(a.name)}${a.optional ? '?' : ''}: ${tsType(a.typid)}`).join('; ')} }`
      : 'Record<PropertyKey, never>';

    const ret = types.get(f.rettype);
    let returns;
    let setof = '';
    if (tableCols.length) {
      returns = `{ ${[...tableCols].sort((a, b) => (a.name < b.name ? -1 : 1)).map((c) => `${key(c.name)}: ${tsType(c.typid)}`).join('; ')} }[]`;
    } else if (ret?.typtype === 'c' && ret.nspname === 'public') {
      const isTable = ret.relkind !== 'c';
      returns = (isTable ? rowType(ret.typrelid) : `${SCHEMA}["CompositeTypes"][${key(ret.typname)}]`) + (f.retset ? '[]' : '');
      setof = `
        SetofOptions: {
          from: "*"
          to: ${key(ret.typname)}
          isOneToOne: ${!f.retset}
          isSetofReturn: ${f.retset}
        }`;
    } else {
      returns = tsType(f.rettype) + (f.retset ? '[]' : '');
    }
    return `{
        Args: ${argsText}
        Returns: ${returns}${setof}
      }`;
  };

  const fnGroups = new Map();
  for (const f of functions) fnGroups.set(f.name, [...(fnGroups.get(f.name) ?? []), f]);
  const fnText = [...fnGroups.entries()].map(([name, group]) => `      ${key(name)}: ${group.map(fnSignature).join(' | ')}`);

  // ---------------------------------------------------------------- output
  const tables = relations.filter((r) => r.relkind === 'r' || r.relkind === 'p');
  const views = relations.filter((r) => r.relkind === 'v' || r.relkind === 'm');
  const composites = relations.filter((r) => r.relkind === 'c');
  const compositeText = composites.map((c) => {
    const cols = colsByRel.get(c.oid) ?? [];
    return `      ${key(c.name)}: {
        ${cols.map((a) => `${key(a.name)}: ${tsType(a.typid)} | null`).join('\n        ')}
      }`;
  });

  return `// Generated from supabase/migrations by \`node supabase/tests/run_local.mjs --types\`. Do not edit by hand.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  "public": {
    Tables: {
${tables.map(tableBlock).join(',\n')}
    }
    Views: {
${views.map(tableBlock).join(',\n')}
    }
    Functions: {
${fnText.join(',\n')}
    }
    Enums: {
${enums.map((e) => `      ${key(e.name)}: ${e.labels.map(key).join(' | ')}`).join('\n')}
    }
    CompositeTypes: {
${compositeText.join(',\n')}
    }
  }
}

${HELPERS}

export const Constants = {
  "public": {
    Enums: {
${enums.map((e) => `      ${key(e.name)}: [${e.labels.map(key).join(', ')}]`).join(',\n')}
    }
  }
} as const
`;
}

const HELPERS = `type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never`;
