import { SymbolTable, ClassSymbol, InterfaceSymbol } from '../common/types.js';

export function extractTypeSignature(className: string, symbolTable: SymbolTable): string {
  const cls = symbolTable.classes.find(c => c.name === className);
  if (cls) return classToSignature(cls);

  const iface = symbolTable.interfaces.find(i => i.name === className);
  if (iface) return interfaceToSignature(iface);

  return '';
}

export function extractDependencySignatures(classSymbol: ClassSymbol, symbolTable: SymbolTable): string {
  const signatures: string[] = [];

  for (const dep of classSymbol.constructorDeps) {
    const depName = extractTypeName(dep);
    const sig = extractTypeSignature(depName, symbolTable);
    if (sig) signatures.push(sig);
  }

  return signatures.join('\n\n');
}

function classToSignature(cls: ClassSymbol): string {
  const lines: string[] = [];
  lines.push(`interface ${cls.name} {`);

  for (const method of cls.methods) {
    const params = method.parameters.map(p => `${p.name}: ${p.type}`).join(', ');
    const asyncPrefix = method.isAsync ? 'async ' : '';
    lines.push(`  ${asyncPrefix}${method.name}(${params}): ${method.returnType};`);
  }

  lines.push('}');
  return lines.join('\n');
}

function interfaceToSignature(iface: InterfaceSymbol): string {
  const lines: string[] = [];
  lines.push(`interface ${iface.name} {`);

  for (const prop of iface.properties) {
    lines.push(`  ${prop.name}: ${prop.type};`);
  }

  for (const method of iface.methods) {
    lines.push(`  ${method.name}(): ${method.returnType};`);
  }

  lines.push('}');
  return lines.join('\n');
}

function extractTypeName(typeStr: string): string {
  return typeStr.replace(/import\([^)]+\)\./, '').trim();
}
