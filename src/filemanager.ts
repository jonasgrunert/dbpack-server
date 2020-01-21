import { promises as fs } from 'fs';
import { pack } from './dbpack/index';
import { join } from 'path';

export async function saveToFile(content: string) {
  try {
    await fs.writeFile(join(process.cwd(), 'mle.ts'), content);
  } catch (e) {
    console.error(e.message);
    throw new Error('Error on saving contents to file');
  }
}

export async function deployFile({connectionString, password, user}:{connectionString:string, password:string, user:string}) {
  await pack('mle.ts', {
    verbose: false,
    emitFiles: false,
    emitStats: false,
    connectionString,
    user,
    password,
    name: "mleeditor"
  });
}
