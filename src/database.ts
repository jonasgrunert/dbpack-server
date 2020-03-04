import oracledb, { ConnectionAttributes, Connection } from 'oracledb';

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
      `SELECT ${func}(${params
        .map(d => (typeof d === 'number' ? d : `'${d}'`))
        .join(', ')}) FROM dual`
    );
    return {
      func,
      params,
      data,
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
