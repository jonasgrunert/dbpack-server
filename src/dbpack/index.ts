#!/usr/bin/env node
import { Transpiler } from './transpiling';
import { CompilerOptions } from 'typescript';
import { Bundler } from './bundling';
import { SQLCreator } from './sqling';
import { SqlLoader } from './loading';
import yargs from 'yargs';
import { join } from 'path';
import { promises as fs } from 'fs';
import { InputOptions, OutputOptions } from 'rollup';

interface PackOptions {
  name?: string;
  tablename?: string;
  connectionString: string;
  verbose: boolean;
  emitFiles: boolean;
  emitStats: boolean;
  inputOptions?: InputOptions;
  outputOptions?: OutputOptions;
  tsOptions?: CompilerOptions;
  dir?: string;
  user?: string;
  password?: string;
}

export async function pack(file: string, opt: PackOptions) {
  const mark = `Finished uploading ${file} in`;
  console.time(mark);
  const transpiled = new Transpiler(file, opt.tsOptions, {
    verbose: opt.verbose,
    emitFiles: opt.emitFiles,
  }).generate();
  const bundle = new Bundler(transpiled.OutputFile, {
    verbose: opt.verbose,
    emitFiles: opt.emitFiles,
    emitStats: opt.emitStats,
    name: opt.name,
    inputOptions: opt.inputOptions,
    outputOptions: opt.outputOptions,
    outputDir: opt.dir,
  });
  const bdl = await bundle.bundle();
  transpiled.cleanup();
  const SQL = new SQLCreator(bdl, transpiled.declerations, {
    verbose: opt.verbose,
    emitFiles: opt.emitFiles,
    name: opt.name,
    tablename: opt.tablename,
    outputDir: opt.dir,
  });
  await SQL.generate();
  const Executor = new SqlLoader(
    opt.connectionString,
    opt.password,
    opt.user,
    opt.tablename,
    {
      verbose: opt.verbose,
    }
  );
  await Executor.init();
  await Executor.execute(SQL.srcLoad.sql, SQL.srcLoad.bindings);
  await Executor.execute(SQL.srcRegister.sql, SQL.srcRegister.bindings);
  await Promise.all(SQL.funcRegister.sql.map(r => Executor.execute(r)));
  console.timeEnd(mark);
}

async function loadConfig(path: string | false) {
  return path
    ? JSON.parse(await fs.readFile(join(process.cwd(), path), 'utf-8'))
    : {};
}

yargs
  .scriptName('dbpack')
  .usage('$0 <cmd> [args]')
  .showHelpOnFail(true)
  .command(
    'pack [file]',
    'packing the function a single time',
    (args: yargs.Argv) =>
      args
        .positional('file', {
          description: 'Name of you entry point file',
          type: 'string',
        })
        .option('t', {
          description: 'Path to TSConfiguration file',
          type: 'string',
          alias: 'tsConfig',
          default: false,
        })
        .option('r', {
          description: 'Path to RollUpConfiguration file',
          type: 'string',
          alias: 'ruConfig',
          default: false,
        })
        .option('v', {
          description: 'This makes dbpack talk a lot',
          type: 'boolean',
          alias: 'verbose',
          default: false,
        })
        .option('e', {
          description: 'This option controls the output of files',
          type: 'boolean',
          alias: 'emitFiles',
          default: false,
        })
        .option('n', {
          description: 'This sets a custom name for the module',
          type: 'string',
          alias: 'name',
          default: 'dbmodule',
        })
        .option('c', {
          description: 'Connection string of the database',
          type: 'string',
          alias: 'connection',
          default: '',
        })
        .option('s', {
          description: 'Let stats be emitted from rollup',
          type: 'boolean',
          alias: 'emitStats',
          default: false,
        })
        .option('tablename', {
          description: 'Table name where to put the src modules',
          type: 'string',
          default: 'dbmodules',
        })
        .option('p', {
          description: 'Password to access database',
          alias: 'dbpassword',
          type: 'string',
          default: 'system',
        })
        .option('u', {
          description: 'Username to access database',
          alias: 'dbuser',
          type: 'string',
          default: 'password',
        }),
    async ({
      file,
      tsConfig,
      ruConfig,
      verbose,
      emitFiles,
      name,
      connection,
      emitStats,
      tablename,
      dbpassword,
      dbuser,
    }: any) => {
      const ts = await loadConfig(tsConfig);
      const co: CompilerOptions = ts.compilerOptions ? ts.compilerOptions : {};
      const ru: {
        outputOptions: OutputOptions;
        inputOptions: InputOptions;
      } = await loadConfig(ruConfig);
      const outDir = co.outDir ? co.outDir : './dist';
      const path = file.split('/');
      await pack(path[path.length - 1], {
        verbose,
        emitFiles,
        emitStats,
        name,
        connectionString: connection,
        tablename,
        tsOptions: co,
        outputOptions: ru.outputOptions,
        inputOptions: ru.inputOptions,
        dir: outDir,
        password: dbpassword,
        user: dbuser,
      });
    }
  ).argv;
