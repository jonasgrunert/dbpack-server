import { InputOptions, rollup, OutputOptions } from 'rollup';
import common from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';

export interface BundlingOptions {
  name: string;
  verbose: boolean;
  emitFiles: boolean;
  emitStats: boolean;
  outputOptions: OutputOptions;
  inputOptions: InputOptions;
  outputDir: string;
}

export class Bundler {
  entryPoint: string;
  options: BundlingOptions;
  middleware: Array<
    (
      file: string,
      opt: BundlingOptions
    ) => Promise<{ file: string; opt: BundlingOptions }>
  >;

  constructor(
    file: string,
    opt?: Partial<BundlingOptions>,
    ...middleware: Array<
      (
        file: string,
        opt: BundlingOptions
      ) => Promise<{ file: string; opt: BundlingOptions }>
    >
  ) {
    this.entryPoint = file;
    this.options = {
      name: 'DBApp',
      outputDir: './dist',
      verbose: false,
      emitFiles: false,
      emitStats: false,
      inputOptions: {},
      outputOptions: {},
      ...opt,
    };
    this.middleware = middleware;
    if (!this.options.verbose) {
      this.options.inputOptions = {
        ...this.options.inputOptions,
        onwarn: () => {},
      };
    }
  }

  private async callMidlleware(i: number) {
    try {
      const { file, opt } = await this.middleware[i](
        this.entryPoint,
        this.options
      );
      this.entryPoint = file || this.entryPoint;
      this.options = opt || this.options;
    } catch (e) {
      process.exitCode = 1;
      console.error(
        `Error while calling custom middleware ${this.middleware[i].name} at position ${i}\n More Ouput is below:`
      );
    }
  }

  async bundle() {
    const mark = 'Bundling finished in';
    console.time(mark);
    if (this.middleware.length > 0) {
      for (let i = 0; i < this.middleware.length; i++) {
        await this.callMidlleware(i);
      }
    }
    const bdl = await rollup({
      input: this.entryPoint,

      plugins: [
        resolve(),
        common({ include: 'node_modules/**' }) /*, uglify()*/,
      ],
    });
    const { output } = await bdl.generate({
      ...this.options.outputOptions,
      name: this.options.name,
      format: 'umd',
    });
    if (this.options.emitFiles) {
      await bdl.write({
        file: `${this.options.outputDir}/${this.options.name}.bundle.js`,
        ...this.options.outputOptions,
        name: this.options.name,
        format: 'umd',
      });
    }
    if (this.options.emitStats) {
      console.timeEnd(mark);
      console.log(
        `Generated ${output.length} chunk${output.length > 1 ? 's' : ''} from ${
          bdl.watchFiles.length
        } file${bdl.watchFiles.length > 1 ? 's' : ''}`
      );
    }
    return output.map(o => (o.type === 'chunk' ? o.code : '')).join('/n');
  }
}
