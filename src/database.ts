import oracledb, { ConnectionAttributes, Connection } from "oracledb";

export async function setup(options: ConnectionAttributes) {
  try {
    const conn = await oracledb.getConnection(options);
    return conn;
  } catch (e) {
    console.error(e.message);
    throw new Error("Failure while creating a database connection");
  }
}

export async function getAllFromTable(conn: Connection, table: string) {
  try {
    const data = await conn.execute(`SELECT * FROM ${table}`);
    return data;
  } catch (e) {
    console.error(e.message);
    throw new Error(`Failure while trying to read from table "${table}"`);
  }
}

export async function executeSql(conn: Connection, sql: string) {
  try {
    const data = await conn.execute(sql);
    return data;
  } catch (e) {
    console.error(e.message);
    throw new Error(
      `Failure while executing sql "${sql}": '${e.errorNum}: ${e.message}${
        e.offset === 0 ? "." : ` at position ${e.offset}.`
      }'`
    );
  }
}

export async function executeTest(
  conn: Connection,
  func: string,
  params: Array<string | number>
) {
  try {
    const data = await conn.execute(
      `SELECT ${func}(${params
        .map(d => (typeof d === "number" ? d : `'${d}'`))
        .join(", ")})`
    );
    return data;
  } catch (e) {
    console.error(e.message);
    throw new Error(
      `Failure while executing function ${func} with ${params.join(", ")}: ${
        e.message
      }`
    );
  }
}
