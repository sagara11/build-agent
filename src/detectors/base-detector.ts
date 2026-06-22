import { Finding, SymbolTable, DependencyGraph, FileMetrics, DetectorThresholds } from '../common/types.js';

export interface DetectorContext {
  symbolTable: SymbolTable;
  dependencyGraph: DependencyGraph;
  fileMetrics: FileMetrics[];
  thresholds: DetectorThresholds;
}

export interface Detector {
  detect(context: DetectorContext): Finding[];
}
