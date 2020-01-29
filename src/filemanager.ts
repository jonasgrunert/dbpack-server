import { promises as fs } from 'fs';
import { pack } from './dbpack/index';
import { join } from 'path';
import { Connection } from 'oracledb';

export async function saveToFile(content: string) {
  try {
    await fs.writeFile(join(process.cwd(), 'mle.ts'), content);
  } catch (e) {
    console.error(e.message);
    throw new Error('Error on saving contents to file');
  }
}

export async function deployFile(connection: Connection, {connectionString, password, user}:{connectionString:string, password:string, user:string}) {
  await pack('mle.ts', {
    tablename: "mlemodules",
    name: "mlemodules",
    verbose: true,
    emitFiles: true,
    emitStats: false,
    connectionString,
    user,
    password,
    connection: connection,
    dir: "mledist"
  });
  return; 
}
