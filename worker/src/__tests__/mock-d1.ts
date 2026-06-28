/**
 * Minimal in-memory D1Database mock for testing.
 * Stores rows in Maps keyed by table name.
 * Supports basic INSERT, SELECT, UPDATE, DELETE with parameterised queries.
 */

interface Row {
  [key: string]: unknown;
}

type TableStore = Map<string, Row[]>;

export function createMockD1(): D1Database & { _tables: TableStore } {
  const tables: TableStore = new Map();

  function getTable(name: string): Row[] {
    if (!tables.has(name)) tables.set(name, []);
    return tables.get(name)!;
  }

  function evaluateWhere(row: Row, conditions: { column: string; value: unknown }[]): boolean {
    return conditions.every(({ column, value }) => row[column] === value);
  }

  function parseSimpleSQL(sql: string, bindings: unknown[]): {
    type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
    table: string;
    data?: Row;
    columns?: string[];
    conditions: { column: string; value: unknown }[];
    returning?: boolean;
    orderBy?: string;
    orderDir?: 'ASC' | 'DESC';
    limit?: number;
    inClause?: { column: string; values: unknown[] };
  } {
    const trimmed = sql.trim().replace(/\s+/g, ' ');
    let bindIdx = 0;

    function nextBind(): unknown {
      return bindings[bindIdx++];
    }

    // INSERT
    const insertMatch = trimmed.match(/INSERT INTO (\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    if (insertMatch) {
      const table = insertMatch[1];
      const columns = insertMatch[2].split(',').map(c => c.trim());
      const valuePlaceholders = insertMatch[3].split(',').map(v => v.trim());
      const data: Row = {};
      for (let i = 0; i < columns.length; i++) {
        if (valuePlaceholders[i] === '?') {
          data[columns[i]] = nextBind();
        } else if (valuePlaceholders[i].includes("datetime('now')")) {
          data[columns[i]] = new Date().toISOString();
        } else {
          // literal value
          data[columns[i]] = valuePlaceholders[i].replace(/'/g, '');
        }
      }
      const returning = /RETURNING/i.test(trimmed);
      return { type: 'INSERT', table, data, conditions: [], returning };
    }

    // SELECT
    const selectMatch = trimmed.match(/SELECT .+ FROM (\w+)/i);
    if (selectMatch) {
      const table = selectMatch[1];
      const conditions: { column: string; value: unknown }[] = [];

      // Parse WHERE clauses
      const whereMatch = trimmed.match(/WHERE (.+?)(?:ORDER|LIMIT|$)/i);
      if (whereMatch) {
        const whereStr = whereMatch[1];
        const andParts = whereStr.split(/\s+AND\s+/i);
        for (const part of andParts) {
          // Handle IN clause
          const inMatch = part.match(/(\w+)\s+IN\s*\(([^)]+)\)/i);
          if (inMatch) {
            // skip IN clauses for simple mock - handled separately
            const placeholders = inMatch[2].split(',').map(p => p.trim());
            for (const p of placeholders) {
              if (p === '?') nextBind();
            }
            continue;
          }

          const condMatch = part.match(/(\w+(?:\.\w+)?)\s*([=<>!]+|IS)\s*(.+)/i);
          if (condMatch) {
            const col = condMatch[1].includes('.') ? condMatch[1].split('.')[1] : condMatch[1];
            const op = condMatch[2].trim();
            const valStr = condMatch[3].trim();

            if (valStr === '?') {
              const val = nextBind();
              if (op === '=') {
                conditions.push({ column: col, value: val });
              }
            } else if (valStr.startsWith("'") && valStr.endsWith("'")) {
              conditions.push({ column: col, value: valStr.slice(1, -1) });
            } else if (valStr.includes("('")) {
              // IN clause with literals
              const literals = valStr.match(/'([^']+)'/g);
              // skip for now
            }
          }
        }
      }

      // Parse LIMIT
      let limit: number | undefined;
      const limitMatch = trimmed.match(/LIMIT\s+(\?|\d+)/i);
      if (limitMatch) {
        if (limitMatch[1] === '?') {
          limit = nextBind() as number;
        } else {
          limit = parseInt(limitMatch[1]);
        }
      }

      // Parse ORDER BY
      let orderBy: string | undefined;
      let orderDir: 'ASC' | 'DESC' = 'DESC';
      const orderMatch = trimmed.match(/ORDER BY\s+(\w+(?:\.\w+)?)\s*(ASC|DESC)?/i);
      if (orderMatch) {
        orderBy = orderMatch[1].includes('.') ? orderMatch[1].split('.')[1] : orderMatch[1];
        if (orderMatch[2]) orderDir = orderMatch[2].toUpperCase() as 'ASC' | 'DESC';
      }

      return { type: 'SELECT', table, conditions, limit, orderBy, orderDir };
    }

    // UPDATE
    const updateMatch = trimmed.match(/UPDATE (\w+) SET (.+?) WHERE (.+)/i);
    if (updateMatch) {
      const table = updateMatch[1];
      const setStr = updateMatch[2];
      const whereStr = updateMatch[3];
      const data: Row = {};

      // Parse SET clauses
      // Handle COALESCE and CASE patterns simply
      const setParts = setStr.split(/,(?![^(]*\))/);
      for (const part of setParts) {
        const setMatch = part.trim().match(/(\w+)\s*=\s*(.+)/i);
        if (setMatch) {
          const col = setMatch[1];
          const valExpr = setMatch[2].trim();
          if (valExpr === '?') {
            data[col] = nextBind();
          } else if (valExpr.includes('COALESCE')) {
            // COALESCE(?, col) — take the binding
            if (valExpr.includes('?')) {
              data[col] = nextBind();
            }
          } else if (valExpr.includes('CASE')) {
            // CASE WHEN ? != '' THEN ? ELSE col END
            const questionMarks = (valExpr.match(/\?/g) || []).length;
            for (let i = 0; i < questionMarks; i++) {
              data[col] = nextBind();
            }
          } else if (valExpr.includes("datetime('now')")) {
            data[col] = new Date().toISOString();
          } else if (valExpr === 'NULL') {
            data[col] = null;
          } else {
            data[col] = valExpr.replace(/'/g, '');
          }
        }
      }

      // Parse WHERE conditions
      const conditions: { column: string; value: unknown }[] = [];
      const whereCondMatch = whereStr.match(/(\w+)\s*=\s*\?/);
      if (whereCondMatch) {
        conditions.push({ column: whereCondMatch[1], value: nextBind() });
      }

      return { type: 'UPDATE', table, data, conditions };
    }

    // DELETE
    const deleteMatch = trimmed.match(/DELETE FROM (\w+)(?: WHERE (.+))?/i);
    if (deleteMatch) {
      const table = deleteMatch[1];
      const conditions: { column: string; value: unknown }[] = [];
      if (deleteMatch[2]) {
        const whereCondMatch = deleteMatch[2].match(/(\w+)\s*=\s*\?/);
        if (whereCondMatch) {
          conditions.push({ column: whereCondMatch[1], value: nextBind() });
        }
      }
      return { type: 'DELETE', table, conditions };
    }

    throw new Error(`Unsupported SQL: ${sql}`);
  }

  function createStatement(sql: string): D1PreparedStatement {
    let bindings: unknown[] = [];

    const stmt: D1PreparedStatement = {
      bind(...args: unknown[]) {
        bindings = args;
        return stmt;
      },
      async first<T = Row>(colName?: string): Promise<T | null> {
        const result = await stmt.all();
        const rows = (result as D1Result<T>).results || [];
        if (rows.length === 0) return null;
        if (colName) return (rows[0] as Row)[colName] as T;
        return rows[0] as T;
      },
      async all<T = Row>(): Promise<D1Result<T>> {
        try {
          const parsed = parseSimpleSQL(sql, bindings);

          if (parsed.type === 'INSERT') {
            const rows = getTable(parsed.table);
            // Auto-generate id if not provided
            if (parsed.data && !parsed.data.id) {
              parsed.data.id = `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            }
            if (parsed.data) {
              parsed.data.created_at = parsed.data.created_at || new Date().toISOString();
              rows.push({ ...parsed.data });
            }
            if (parsed.returning && parsed.data) {
              return {
                results: [parsed.data as T],
                success: true,
                meta: {} as D1Meta,
              };
            }
            return { results: [] as T[], success: true, meta: {} as D1Meta };
          }

          if (parsed.type === 'SELECT') {
            let rows = getTable(parsed.table);
            rows = rows.filter(row => evaluateWhere(row, parsed.conditions));

            if (parsed.orderBy) {
              rows.sort((a, b) => {
                const aVal = String(a[parsed.orderBy!] || '');
                const bVal = String(b[parsed.orderBy!] || '');
                return parsed.orderDir === 'ASC'
                  ? aVal.localeCompare(bVal)
                  : bVal.localeCompare(aVal);
              });
            }

            if (parsed.limit !== undefined) {
              rows = rows.slice(0, parsed.limit);
            }

            return {
              results: rows.map(r => ({ ...r })) as T[],
              success: true,
              meta: {} as D1Meta,
            };
          }

          if (parsed.type === 'UPDATE') {
            const rows = getTable(parsed.table);
            for (const row of rows) {
              if (evaluateWhere(row, parsed.conditions)) {
                for (const [key, value] of Object.entries(parsed.data || {})) {
                  // COALESCE behavior: only update if value is not null
                  if (value !== null) {
                    row[key] = value;
                  }
                }
              }
            }
            return { results: [] as T[], success: true, meta: {} as D1Meta };
          }

          if (parsed.type === 'DELETE') {
            const rows = getTable(parsed.table);
            const remaining = rows.filter(row => !evaluateWhere(row, parsed.conditions));
            tables.set(parsed.table, remaining);
            return { results: [] as T[], success: true, meta: {} as D1Meta };
          }
        } catch {
          // Fallback for complex queries
          return { results: [] as T[], success: true, meta: {} as D1Meta };
        }

        return { results: [] as T[], success: true, meta: {} as D1Meta };
      },
      async run(): Promise<D1Result> {
        return stmt.all();
      },
      async raw<T = unknown[]>(): Promise<T[]> {
        const result = await stmt.all();
        return (result.results || []) as T[];
      },
    };

    return stmt;
  }

  return {
    _tables: tables,
    prepare(sql: string) {
      return createStatement(sql);
    },
    async dump() {
      return new ArrayBuffer(0);
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      const results: D1Result<T>[] = [];
      for (const stmt of statements) {
        results.push(await stmt.all<T>());
      }
      return results;
    },
    async exec(sql: string): Promise<D1ExecResult> {
      return { count: 0, duration: 0 };
    },
  };
}

/**
 * Seed helper: insert rows directly into mock tables
 */
export function seedTable(db: ReturnType<typeof createMockD1>, table: string, rows: Row[]) {
  if (!db._tables.has(table)) db._tables.set(table, []);
  const tableRows = db._tables.get(table)!;
  for (const row of rows) {
    tableRows.push({ ...row });
  }
}
