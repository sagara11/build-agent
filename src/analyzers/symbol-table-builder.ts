import { SourceFile, SyntaxKind } from 'ts-morph';
import { SymbolTable, ClassSymbol, FunctionSymbol, InterfaceSymbol, MethodSymbol } from '../common/types.js';

export function buildSymbolTable(sourceFiles: SourceFile[]): SymbolTable {
  const classes: ClassSymbol[] = [];
  const functions: FunctionSymbol[] = [];
  const interfaces: InterfaceSymbol[] = [];

  for (const sf of sourceFiles) {
    const filePath = sf.getFilePath();

    for (const cls of sf.getClasses()) {
      const methods: MethodSymbol[] = cls.getMethods().map(m => ({
        name: m.getName(),
        isAsync: m.isAsync(),
        returnType: m.getReturnType().getText(m),
        parameters: m.getParameters().map(p => ({
          name: p.getName(),
          type: p.getType().getText(p),
        })),
      }));

      const constructorDeps: string[] = [];
      const ctor = cls.getConstructors()[0];
      if (ctor) {
        for (const param of ctor.getParameters()) {
          constructorDeps.push(param.getType().getText(param));
        }
      }

      classes.push({
        name: cls.getName() || '(anonymous)',
        filePath,
        methods,
        constructorDeps,
        isExported: cls.isExported(),
      });
    }

    for (const fn of sf.getFunctions()) {
      functions.push({
        name: fn.getName() || '(anonymous)',
        filePath,
        isAsync: fn.isAsync(),
        isExported: fn.isExported(),
        returnType: fn.getReturnType().getText(fn),
        parameters: fn.getParameters().map(p => ({
          name: p.getName(),
          type: p.getType().getText(p),
        })),
      });
    }

    for (const iface of sf.getInterfaces()) {
      interfaces.push({
        name: iface.getName(),
        filePath,
        isExported: iface.isExported(),
        methods: iface.getMethods().map(m => ({
          name: m.getName(),
          returnType: m.getReturnType().getText(m),
        })),
        properties: iface.getProperties().map(p => ({
          name: p.getName(),
          type: p.getType().getText(p),
        })),
      });
    }
  }

  return { classes, functions, interfaces };
}
