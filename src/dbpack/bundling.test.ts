import { promises as fs } from 'fs';
import { Bundler } from './bundling';

let spy: { log: jest.SpyInstance; time: jest.SpyInstance };
beforeEach(() => {
  spy = {
    log: jest.spyOn(console, 'log').mockImplementation(() => {}),
    time: jest.spyOn(console, 'timeEnd').mockImplementation(() => {}),
  };
});
afterEach(() => {
  if (spy.log && spy.time) {
    spy.log.mockClear(), spy.time.mockClear();
  }
});
afterAll(() => {
  if (spy.log && spy.time) {
    spy.log.mockRestore(), spy.time.mockRestore();
  }
});

const testOptions = {
  file: 'test.ts',
  options: {
    name: 'TestApp',
    verbose: true,
    emitFiles: true,
    emitStats: true,
    inputOptions: {
      perf: true,
    },
    outputOptions: {
      compact: true,
    },
  },
};

const testExpects = {
  defaultOptions: {
    name: 'DBApp',
    verbose: false,
    emitFiles: false,
    emitStats: false,
    inputOptions: {
      onwarn: () => {},
    },
    outputOptions: {},
  },
};

describe('Bundler init', () => {
  test('Creating new bundler with defaults', () => {
    const bundler = new Bundler(testOptions.file);
    expect(bundler).toBeInstanceOf(Bundler);
    expect(bundler.options.name).toEqual(testExpects.defaultOptions.name);
    expect(bundler.options.verbose).toEqual(testExpects.defaultOptions.verbose);
    expect(bundler.options.emitFiles).toEqual(
      testExpects.defaultOptions.emitFiles
    );
    expect(bundler.options.emitStats).toEqual(
      testExpects.defaultOptions.emitStats
    );
    expect(Object.keys(bundler.options.inputOptions).length).toBe(1);
    expect(bundler.options.inputOptions.onwarn).toBeDefined();
    expect(bundler.options.outputOptions).toEqual(
      testExpects.defaultOptions.outputOptions
    );
    expect(bundler.entryPoint).toBe(testOptions.file);
    expect(bundler.middleware.length).toBe(0);
  });
  test('Creating new bundler with options', () => {
    const bundler = new Bundler(
      testOptions.file,
      testOptions.options,
      (file, opt) => new Promise(resolve => resolve({ file, opt }))
    );
    expect(bundler).toBeInstanceOf(Bundler);
    expect(bundler.options.name).toEqual(testOptions.options.name);
    expect(bundler.options.verbose).toEqual(testOptions.options.verbose);
    expect(bundler.options.emitFiles).toEqual(testOptions.options.emitFiles);
    expect(bundler.options.emitStats).toEqual(testOptions.options.emitStats);
    expect(Object.keys(bundler.options.inputOptions).length).toBe(1);
    expect(bundler.options.inputOptions.onwarn).toBeUndefined();
    expect(bundler.options.outputOptions).toEqual(
      testOptions.options.outputOptions
    );
    expect(bundler.entryPoint).toBe(testOptions.file);
    expect(bundler.middleware.length).toBe(1);
  });
});

describe('Bundler bundles', () => {
  test('Bundling without verbosity', async () => {
    await fs.writeFile(
      'test.js',
      `export function square(a){
        return a*a;
      }`
    );
    expect(await new Bundler('test.js').bundle()).toBeDefined();
    await fs.unlink('test.js');
  });
  test('Bundling with stats', async () => {
    await fs.writeFile(
      'test.js',
      `export function square(a){
        return a*a;
      }`
    );
    expect(
      await new Bundler('test.js', { emitStats: true }).bundle()
    ).toBeDefined();
    expect(spy.log).toHaveBeenCalledTimes(1);
    const log = <jest.SpyInstance>spy.log;
    expect(log.mock.calls[0][0]).toMatch(
      /Generated \d+ chunks? from \d+ files?/
    );
    expect(spy.time).toHaveBeenCalledTimes(1);
    const time = <jest.SpyInstance>spy.time;
    expect(time.mock.calls[0][0]).toMatch(/Bundling finished in/);
  });
  test('Bundling with verbosity', async () => {
    await fs.writeFile(
      'test.js',
      `export function square(a){
        return a*a;
      }`
    );
    expect(
      await new Bundler('test.js', { verbose: true }).bundle()
    ).toBeDefined();
    // TODO
    expect(spy.log).toHaveBeenCalledTimes(0);
    await fs.unlink('test.js');
  });
  test('Bundling with emittedFiles', async () => {
    await fs.writeFile(
      'test.js',
      `export function square(a){
        return a*a;
      }`
    );
    const bundler = new Bundler('test.js', { emitFiles: true });
    const bundle = await bundler.bundle();
    expect(bundle).toBeDefined();
    let data = undefined;
    try {
      data = await fs.readFile('DBApp.bundle.js');
      await fs.unlink('DBApp.bundle.js');
    } catch (e) {
      console.error(e);
    }
    expect(data).toBeDefined();
    await fs.unlink('test.js');
  });
});
