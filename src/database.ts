/* eslint-disable @typescript-eslint/camelcase */
import { timeStamp } from 'console';
import oracledb, { ConnectionAttributes, Connection } from 'oracledb';
import { string } from 'yargs';

oracledb.fetchAsString = [oracledb.CLOB];

export async function setup(options: ConnectionAttributes) {
  try {
    const conn = await oracledb.getConnection(options);
    return conn;
  } catch (e) {
    console.error(e.message);
    throw new Error('Failure while creating a database connection');
  }
}

export async function getAllFromTable(conn: Connection, table: string) {
  try {
    const select = `SELECT * FROM ${table}`;
    const data = await conn.execute(select);
    return data;
  } catch (e) {
    console.error(e.message);
    throw new Error(`Failure while trying to read from table "${table}"`);
  }
}

export async function executeSql(conn: Connection, sql: string) {
  try {
    const data = await conn.execute(sql);
    await conn.commit();
    return data;
  } catch (e) {
    console.error(e.message);
    throw new Error(
      `Failure while executing sql "${sql}": '${e.errorNum}: ${e.message}${
        e.offset === 0 ? '.' : ` at position ${e.offset}.`
      }'`
    );
  }
}

export async function executeTest(
  id: string,
  conn: Connection,
  func: string,
  params: Array<string | number>
) {
  try {
    const data = await conn.execute(
      `call ${func}(${params
        .map((_, i) => `:in${i}`)
        .join(', ')}) INTO :outVar`,
      [
        ...params,
        {
          dir: oracledb.BIND_OUT,
          type: oracledb.CLOB,
          maxSize: 32767,
        },
      ]
    );
    const out: string = await new Promise((res, rej) => {
      let str = '';
      const lob = (data.outBinds as any[])[0];
      lob.setEncoding('utf8');
      lob.on('data', (d: string) => {
        str += d;
        console.log(str.length);
      });
      lob.on('error', (err: string) => {
        rej(new Error(err));
      });
      lob.on('end', () => {
        res(str);
      });
    });
    console.log(out);
    return {
      func,
      params,
      data: out,
      id,
    };
  } catch (e) {
    console.error(e.message);
    throw new Error(
      `Failure while executing function ${func} with ${params.join(', ')}: ${
        e.message
      }`
    );
  }
}

export async function getTypes(connection: Connection) {
  const res = await connection.execute(
    "SELECT types FROM mlemodules WHERE module_id=(SELECT MAX(module_id) FROM mlemodules WHERE name='mlemodules')"
  );
  if (res.rows && res.rows[0] && res.rows[0]) {
    if (!Array.isArray(res.rows[0])) throw new Error('No types found');
    return JSON.parse(res.rows[0][0]);
  } else {
    throw new Error('Unable to retrieve types.');
  }
}

export async function multipleTests(
  connection: Connection,
  tests: Array<{ id: string; func: string; params: Array<string | number> }>
) {
  try {
    const res = await Promise.all(
      tests.map(t =>
        connection.execute(
          `SELECT ${t.func}(${t.params
            .map(d => (typeof d === 'number' ? d : `'${d}'`))
            .join(', ')}) FROM dual`
        )
      )
    );
    return res.map(({ rows }, i) => {
      if (rows) {
        const col = rows[0] as Array<string>;
        return { id: tests[i].id, result: col[0] };
      } else {
        throw new Error('No rows available');
      }
    });
  } catch (e) {
    console.error(e.message);
    throw new Error(`Failure while testing multiple cases;`);
  }
}

export async function benchmark(connection: Connection) {
  try {
    let result: number[] = [];
    type Repo = { id: string; url: string };
    const repos = await connection.execute<Repo>('SELECT * from PROJECTS', [], {
      resultSet: true,
    });
    let repo: Repo;
    while ((repo = await repos.resultSet!.getRow())) {
      type PR = { id: string };
      const prs = await connection.execute<PR>(
        'SELECT * from pull_requests where head_repo_id = :id',
        [repo.id],
        { resultSet: true }
      );
      let pr: PR;
      const times: number[] = [];
      while ((pr = await prs.resultSet!.getRow())) {
        type Event = { created_at: Date; action: string };
        const events = await connection.execute<Event>(
          'SELECT * FROM pull_request_history where_pull_request_id = :id',
          [pr.id]
        );
        const time = events.rows!.reduce(
          ({ opened, last }, { created_at, action }) => {
            if (!opened || opened > created_at) {
              return { opened: created_at, last };
            }
            if (action.startsWith('closed') || action.startsWith('merged')) {
              if (!last || last < created_at) {
                return { opened, last: created_at };
              }
            }
            return { opened, last };
          },
          { opened: false, last: false } as {
            opened: false | Date;
            last: false | Date;
          }
        );
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        times.push(time.last - time.opened);
      }
      prs.resultSet!.close();
      const avg = times.reduce((p, c) => p + c, 0) / times.length;
      if (result.length < 10) {
        result.push(avg);
      } else if (result[9] < avg) {
        result[9] = avg;
      }
      result = result.sort();
    }
    repos.resultSet!.close();
    return result;
  } catch (e) {
    console.error(e.message);
    throw new Error(`Failure while benchmarking;`);
  }
}
