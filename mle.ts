export function evaluate(ev: string): string {
  const conn = _dbRequire('@oracle/sql');
  class SQL {
    private iter: any;
    mapper: any[] = [];
    private data: any[];

    constructor(iter: any) {
      this.iter = iter;
    }

    private createObject(row: any) {
      const { names } = this.iter.rows;
      const obj = {};
      for (let i = 0; i < row.length; i++) {
        const attr = Object.keys(names).find(idx => names[idx] === i);
        obj[attr.toLowerCase()] = row[i];
      }
      return obj;
    }

    map(func: any) {
      this.mapper.push(func);
      return this;
    }

    reduce(func: any, prim?: any) {
      let prev = prim;
      for (const row of this.iter.rows) {
        prev = func(
          prev,
          this.mapper.reduce((p, c) => c(p), this.createObject(row))
        );
      }
      return prev;
    }

    eject() {
      if(this.data) return this.arr;
      const arr = [];
      for (const row of this.iter.rows) {
        arr.push(this.mapper.reduce((p, c) => c(p), this.createObject(row)));
      }
      this.data = arr;
      return arr;
    }

    toJSON() {
      return this.eject();
    }
  }
  function sql(strings, ...args) {
    let command = strings.map((s, i) => (args[i] ? `${s}:in${i}` : s)).join('');
    const reg = /(?:SELECT|select) (?<select>(\w*, )+|\*) (?:FROM|from) (?<tablename>\w*)/.exec(
      command
    ); 
    if (reg != null && reg.groups.select && reg.groups.tablename) {
      const {
        tablename,
        select,
      } = reg.groups;
      let arr = global.MLEtableInfo.has(tablename.toUpperCase())
        ? global.MLEtableInfo.get(tablename.toUpperCase())
        : [];
      if (arr.length == 0) {
        for (const row of conn.execute(
          `select column_name, data_type from ALL_TAB_COLUMNS where table_name= :tablename and owner = 'SYSTEM'`,
          { tablename: tablename.toUpperCase() }
        ).rows) {
          arr.push(row);
        }
        global.MLEtableInfo.set(tablename.toUpperCase(), arr);
      }
      if (select !== '*') {
        arr = arr.filter(([column]) => select.toUpperCase().includes(column));
      }
      command = command.replace(
        select,
        arr
          .map(([column, type]) =>
            type.startsWith('TIMESTAMP')
              ? `cast(${column} as date) AS "${column}"`
              : column
          )
          .join(', ')
      );
    }
    const result = conn.execute(command, args);
    if (result.rowsAffected) {
      return `Updated ${result.rowsAffected} row${
        result.rowsAffected === 1 ? '' : 's'
      }.`;
    }
    return new SQL(result);
  }
  global.sql = sql;
  global.SQL = SQL;
  global.MLEtableInfo = global.MLEtableInfo ?? new Map();
  return JSON.stringify(eval(ev), (_, s) =>
    typeof s === 'undefined' ? 'undefined' : s
  );
}
