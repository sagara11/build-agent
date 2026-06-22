export type AstActionType =
  | 'extract_class'
  | 'extract_method'
  | 'replace_node'
  | 'convert_async'
  | 'rename_symbol';

export interface ExtractClassAction {
  action: 'extract_class';
  sourceFile: string;
  className: string;
  methodNames: string[];
  newFileName: string;
  newClassName: string;
}

export interface ExtractMethodAction {
  action: 'extract_method';
  sourceFile: string;
  className: string;
  methodName: string;
  startLine: number;
  endLine: number;
  newMethodName: string;
}

export interface ReplaceNodeAction {
  action: 'replace_node';
  sourceFile: string;
  startLine: number;
  endLine: number;
  newCode: string;
}

export interface ConvertAsyncAction {
  action: 'convert_async';
  sourceFile: string;
  className: string;
  methodName: string;
}

export interface RenameSymbolAction {
  action: 'rename_symbol';
  sourceFile: string;
  oldName: string;
  newName: string;
}

export type AstAction =
  | ExtractClassAction
  | ExtractMethodAction
  | ReplaceNodeAction
  | ConvertAsyncAction
  | RenameSymbolAction;

export interface AstActionList {
  actions: AstAction[];
  reasoning: string;
}
