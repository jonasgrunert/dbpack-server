export function evaluate(ev) {
    var _a;
    const conn = _dbRequire('@oracle/sql');
    class SQL {
        constructor(iter) {
            this.mapper = [];
            this.iter = iter;
        }
        createObject(row) {
            const { names } = this.iter.rows;
            const obj = {};
            for (let i = 0; i < row.length; i++) {
                const attr = Object.keys(names).find(idx => names[idx] === i);
                obj[attr.toLowerCase()] = row[i];
            }
            return obj;
        }
        map(func) {
            this.mapper.push(func);
            return this;
        }
        reduce(func, prim) {
            let prev = prim;
            for (const row of this.iter.rows) {
                prev = func(prev, this.mapper.reduce((p, c) => c(p), this.createObject(row)));
            }
            return prev;
        }
        eject() {
            if (this.data)
                return this.arr;
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
        const reg = /(?:SELECT|select) (?<select>(\w*, )+|\*) (?:FROM|from) (?<tablename>\w*)/.exec(command);
        if (reg != null && reg.groups.select && reg.groups.tablename) {
            const { tablename, select, } = reg.groups;
            let arr = global.MLEtableInfo.has(tablename.toUpperCase())
                ? global.MLEtableInfo.get(tablename.toUpperCase())
                : [];
            if (arr.length == 0) {
                for (const row of conn.execute(`select column_name, data_type from ALL_TAB_COLUMNS where table_name= :tablename and owner = 'SYSTEM'`, { tablename: tablename.toUpperCase() }).rows) {
                    arr.push(row);
                }
                global.MLEtableInfo.set(tablename.toUpperCase(), arr);
            }
            if (select !== '*') {
                arr = arr.filter(([column]) => select.toUpperCase().includes(column));
            }
            command = command.replace(select, arr
                .map(([column, type]) => type.startsWith('TIMESTAMP')
                ? `cast(${column} as date) AS "${column}"`
                : column)
                .join(', '));
        }
        const result = conn.execute(command, args);
        if (result.rowsAffected) {
            return `Updated ${result.rowsAffected} row${result.rowsAffected === 1 ? '' : 's'}.`;
        }
        return new SQL(result);
    }
    global.sql = sql;
    global.SQL = SQL;
    global.MLEtableInfo = (_a = global.MLEtableInfo, (_a !== null && _a !== void 0 ? _a : new Map()));
    // global.tableInfo = global.tableInfo ?? new Map();
    return JSON.stringify(eval(ev), (_, s) => typeof s === 'undefined' ? 'undefined' : s);
}
/*
import {SocketSingleton} from 'src/components/mle/socket.js';

const id = "MLE"
var codemirror = document.body.querySelector(`#${id}`);
(async () => {
  if (!codemirror) {
    codemirror = await lively.openWorkspace("// sql`SELECT * FROM students`")
    codemirror.parentElement.setAttribute("title", `${id} Workspace`)
    codemirror.id = id
  }
  codemirror.boundEval = async function(s) {
    const socket = SocketSingleton.get();
    socket.emit("test", {id, func: "evaluate", parameters: [s]})
    return new Promise((res) => {
      socket.on("result", r => res({value: JSON.parse(r.rows[0][0])}));
    });
  }
})();
*/
