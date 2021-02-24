import { FunctionSignature, Type } from './transpiling';
import { promises as fs } from 'fs';
import { BindParameters } from 'oracledb';

interface SQLOptions {
  verbose: boolean;
  emitFiles: boolean;
  tablename: string;
  name: string;
  outputDir: string;
}

export interface SQLExec {
  sql: string;
  bindings?: BindParameters;
}

const escapeDots = (str: string): string => str.replace(/\./, '\\.');

const generateParameters = ({
  name,
  type,
}: {
  name: string;
  type: Type;
}): { sql: string; js: string } => {
  let dbType = 'VARCHAR2';
  let jsType = 'string';
  switch (type) {
    case Type.number:
      dbType = 'NUMBER';
      jsType = 'number';
      break;
    case Type.string:
      dbType = 'VARCHAR2';
      jsType = 'string';
      break;
    case Type.none:
      throw new Error(`None cannot be the type of parameter ${name}`);
    default:
      throw new Error('This should never happen. Please file an issue.');
  }
  return { sql: `${name} IN ${dbType}`, js: `${name} ${jsType}` };
};

const generateReturnType = ({
  returnType,
}: {
  returnType: Type;
}): { sql: string; js: string } => {
  let dbType = 'VARCHAR2';
  let jsType = 'string';
  switch (returnType) {
    case Type.number:
      dbType = 'NUMBER';
      jsType = 'number';
      break;
    case Type.string:
      dbType = 'VARCHAR2';
      jsType = 'string';
      break;
    case Type.none:
      dbType = '';
      jsType = '';
      break;
    default:
      throw new Error('This should never happen. Please file an issue.');
  }
  return { sql: dbType, js: jsType };
};

export class SQLCreator {
  src: string;
  types: FunctionSignature[];
  options: SQLOptions;
  protected _srcLoad: string | false = false;
  protected _srcRegister: string | false = false;
  protected _funcRegister: string[] | false = false;

  private log(message: string, level: 'log' | 'warn' | 'error' = 'log') {
    if (this.options.verbose) {
      console[level](message);
    }
  }

  constructor(
    src: string,
    types: FunctionSignature[],
    opt?: Partial<SQLOptions>
  ) {
    this.src = src;
    this.types = types;
    this.options = {
      verbose: false,
      emitFiles: false,
      tablename: 'mlemodules',
      outputDir: './dist',
      name: 'mlemodules',
      ...opt,
    };
  }

  get srcLoad(): SQLExec {
    if (this._srcLoad) {
      return {
        sql: `${this._srcLoad}`,
        bindings: [this.options.name, JSON.stringify(this.types), this.src],
      };
    }
    throw new Error('SrcLoad does not exist did you call generate()?');
  }

  get srcRegister(): SQLExec {
    if (this._srcRegister) {
      return { sql: `${this._srcRegister}` };
    }
    throw new Error('SrcRegister does not exist did you call generate()?');
  }

  get funcRegister(): { sql: string[] } {
    if (this._funcRegister) {
      return { sql: this._funcRegister ? this._funcRegister! : [] };
    }
    throw new Error('FuncRegister does not exist did you call generate()?');
  }

  private generateSrcLoader() {
    this._srcLoad = `INSERT INTO ${this.options.tablename} (name, types, source) VALUES (:name, :types, :src)`;
  }

  private generateSrcRegister() {
    this._srcRegister = `CREATE OR REPLACE JAVASCRIPT SOURCE NAMED "${this.options.name}" USING CLOB SELECT source FROM ${this.options.tablename} WHERE module_id = (SELECT max(module_id) FROM ${this.options.tablename} WHERE name = '${this.options.name}');`;
  }

  private generateFunRegister() {
    const parameters = this.types.map(type =>
      type.parameters.map(generateParameters)
    );
    const sqlParameters = parameters.map(p =>
      p.length === 0 ? '' : `(${p.map(({ sql }) => sql).join(', ')})`
    );
    const jsParameters = parameters.map(p => p.map(({ js }) => js).join(', '));
    const returnTypes = this.types.map(generateReturnType);
    const sqlFunc = this.types.map((type, i) =>
      type.returnType === Type.none
        ? `CREATE OR REPLACE PROCEDURE ${type.name}${
            sqlParameters[i]
          } AS LANGUAGE JAVASCRIPT NAME '${escapeDots(this.options.name)}.${
            type.name
          }(${jsParameters[i]})';`
        : `CREATE OR REPLACE FUNCTION ${type.name}${sqlParameters[i]} RETURN ${
            returnTypes[i].sql
          } AS LANGUAGE JAVASCRIPT NAME '${escapeDots(this.options.name)}.${
            type.name
          }(${jsParameters[i]}) return ${returnTypes[i].js}';`
    );
    this._funcRegister = sqlFunc;
  }
  async generate() {
    this.log('Generating SrcLoader');
    this.generateSrcLoader();
    this.log('Generating SrcRegister');
    this.generateSrcRegister();
    this.log('Generating FuncRegitser');
    this.generateFunRegister();
    if (this.options.emitFiles) {
      this.log('Writing Files out');
      await Promise.all([
        fs.writeFile(`${this.options.outputDir}/loader.sql`, this._srcLoad),
        fs.writeFile(`${this.options.outputDir}/source.sql`, this._srcRegister),
        fs.writeFile(
          `${this.options.outputDir}/register.sql`,
          (this._funcRegister as string[]).join('\n')
        ),
      ]);
      this.log('Finished writing files out');
    }
    return this;
  }
}
