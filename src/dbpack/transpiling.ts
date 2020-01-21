import {
  Node,
  Program,
  TypeChecker,
  CompilerOptions,
  createProgram,
  forEachChild,
  Symbol,
  isFunctionDeclaration,
  isArrowFunction,
  Signature,
  isIdentifier,
  SyntaxKind,
} from 'typescript';
import { promises as fs } from 'fs';
import { join } from 'path';

interface TranspilingOptions {
  verbose: boolean;
  emitFiles: boolean;
}

export enum Type {
  string,
  number,
  none,
}

export interface FunctionSignature {
  name: string;
  parameters: { name: string; type: Type }[];
  returnType: Type;
}

function isNodeExported(node: Node): boolean {
  return node.modifiers
    ? node.modifiers.some(d => d.kind === SyntaxKind.ExportKeyword)
    : false;
}

async function rmdir(dir: string): Promise<void> {
  const files = await fs.readdir(dir);
  await Promise.all(
    files.map(async f => {
      const stat = await fs.lstat(join(dir, f));
      if (stat.isDirectory()) {
        await rmdir(join(dir, f));
      } else {
        await fs.unlink(join(dir, f));
      }
    })
  );
  await fs.rmdir(dir);
}

export class Transpiler {
  protected options: TranspilingOptions;
  protected program: Program;
  protected checker: TypeChecker;
  readonly declerations: FunctionSignature[] = [];
  protected indexFile: string;

  private log(message: string, level: 'log' | 'warn' | 'error' = 'log') {
    if (this.options.verbose) {
      console[level](message);
    }
  }

  convertTypetoEnum(type: string): Type {
    switch (type) {
      case 'string':
        return Type.string;
      case 'number':
        return Type.number;
      case 'void':
        return Type.none;
      default: {
        this.log(
          `Unable to identify type ${type} as one of the db suitable types. Assuming none`
        );
        return Type.none;
      }
    }
  }

  constructor(
    filename: string,
    tsOptions: CompilerOptions = { outDir: './mledist' },
    transpilerOptions?: Partial<TranspilingOptions>
  ) {
    this.program = createProgram([filename], {
      outDir: join(process.cwd(), 'mledist'),
      ...tsOptions,
    });
    this.checker = this.program.getTypeChecker();
    this.options = { verbose: false, emitFiles: false, ...transpilerOptions };
    this.indexFile = join(process.cwd(), "mledist", filename.replace('ts', 'js'));
  }

  get OutputFile() {
    return this.indexFile;
  }

  private generateParameterSignature(func: readonly Signature[], child: Node) {
    return func.map(a =>
      a.getParameters().map(b => ({
        name: b.name,
        type: this.convertTypetoEnum(
          this.checker.typeToString(
            this.checker.getTypeOfSymbolAtLocation(b, child)
          )
        ),
      }))
    );
  }

  private generateReturnType(func: readonly Signature[]) {
    return func.map(a =>
      this.convertTypetoEnum(
        this.checker.typeToString(this.checker.getReturnTypeOfSignature(a))
      )
    );
  }

  private generateFunctionSignature(symbol: Symbol, child: Node) {
    const func = this.checker
      .getTypeOfSymbolAtLocation(symbol, child)!
      .getCallSignatures();
    const name = this.checker.getSymbolAtLocation(child)!.name;
    const parameters = this.generateParameterSignature(func, child)[0];
    const returnType = this.generateReturnType(func)[0];
    this.log(`Adding decleration for function ${name}`);
    this.declerations.push({ name, returnType, parameters });
  }

  private checkNode(node: Node) {
    if (isNodeExported(node)) {
      if (isFunctionDeclaration(node)) {
        // Declared as normal function
        node.forEachChild(child => {
          let symbol = this.checker.getSymbolAtLocation(child);
          if (symbol) {
            this.generateFunctionSignature(symbol, child);
          }
        });
      } else if (isArrowFunction(node)) {
        let name = '';
        node.parent.forEachChild(child => {
          if (isIdentifier(child)) {
            name = this.checker.getSymbolAtLocation(child)!.name;
          }
        });
        node.forEachChild(child => {
          let symbol = this.checker.getSymbolAtLocation(child);
          if (symbol) {
            const func = this.checker
              .getTypeOfSymbolAtLocation(symbol, child)!
              .getCallSignatures();
            const returnType = this.generateReturnType(func)[0];
            const parameters = this.generateParameterSignature(func, child)[0];
            this.log(`Adding decleration for function ${name}`);
            this.declerations.push({ name, returnType, parameters });
          }
        });
      } else {
        // Further traversing the path
        node.forEachChild(child => this.checkNode(child));
      }
    }
  }

  generate() {
    for (const sourceFile of this.program.getSourceFiles()) {
      if (!sourceFile.isDeclarationFile) {
        // Walk the tree to search for exports
        this.log('Now traversing AST');
        forEachChild(sourceFile, this.checkNode.bind(this));
      }
    }
    this.program.emit();
    return this;
  }

  async cleanup() {
    if (!this.options.emitFiles) {
      this.log('Removing generated Files');
      await rmdir(this.program.getCompilerOptions().outDir!);
    }
  }
}
