export interface MethodSymbol {
  name: string;
  isAsync: boolean;
  returnType: string;
  parameters: Array<{ name: string; type: string }>;
}

export interface ClassSymbol {
  name: string;
  filePath: string;
  methods: MethodSymbol[];
  constructorDeps: string[];
  isExported: boolean;
}

export interface FunctionSymbol {
  name: string;
  filePath: string;
  isAsync: boolean;
  isExported: boolean;
  returnType: string;
  parameters: Array<{ name: string; type: string }>;
}

export interface InterfaceSymbol {
  name: string;
  filePath: string;
  isExported: boolean;
  methods: Array<{ name: string; returnType: string }>;
  properties: Array<{ name: string; type: string }>;
}

export interface SymbolTable {
  classes: ClassSymbol[];
  functions: FunctionSymbol[];
  interfaces: InterfaceSymbol[];
}

export interface DependencyEdge {
  from: string;
  to: string;
}

export interface DependencyGraph {
  adjacency: Map<string, string[]>;
  edges: DependencyEdge[];
}

export interface MethodMetrics {
  name: string;
  cyclomaticComplexity: number;
  loc: number;
}

export interface ClassMetrics {
  name: string;
  filePath: string;
  loc: number;
  methodCount: number;
  methods: MethodMetrics[];
  avgComplexity: number;
  maxComplexity: number;
  coupling: number;
}

export interface FileMetrics {
  filePath: string;
  loc: number;
  classes: ClassMetrics[];
  coupling: number;
}

export type SmellType = 'god-class' | 'long-method' | 'high-complexity' | 'duplicated-code';
export type Severity = 'medium' | 'high' | 'critical';

export interface Finding {
  smellType: SmellType;
  file: string;
  lineStart: number;
  lineEnd: number;
  severity: Severity;
  confidence: number;
  metrics: Record<string, number>;
  message: string;
  responsibilityGroups?: ResponsibilityGroup[];
}

export interface ResponsibilityGroup {
  name: string;
  methods: string[];
}

export interface DetectorThresholds {
  godClassLoc: number;
  godClassMethods: number;
  godClassCoupling: number;
  longMethodLoc: number;
  highComplexity: number;
}

export const DEFAULT_THRESHOLDS: DetectorThresholds = {
  godClassLoc: 300,
  godClassMethods: 10,
  godClassCoupling: 3,
  longMethodLoc: 50,
  highComplexity: 10,
};
