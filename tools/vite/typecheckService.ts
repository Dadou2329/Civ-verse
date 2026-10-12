/**
 * Incremental type-checking for Civilization Studio's script editor.
 *
 * Uses the TypeScript LanguageService over the project's tsconfig.json so that scripts are checked
 * with exactly the same types, paths and strictness as `npm run typecheck`. The service stays warm
 * inside the dev server: the first request takes a few seconds, later requests only re-check what
 * changed.
 */
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

export interface StudioDiagnostic {
  file: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  message: string;
  category: 'error' | 'warning' | 'suggestion' | 'message';
  code: number;
}

export interface TypecheckService {
  check(absFiles: string[]): StudioDiagnostic[];
  invalidate(absFile: string): void;
}

export function createTypecheckService(repoRoot: string): TypecheckService {
  const configPath = path.join(repoRoot, 'tsconfig.json');
  const versions = new Map<string, number>();
  let parsed = loadConfig();

  function loadConfig(): ts.ParsedCommandLine {
    const read = ts.readConfigFile(configPath, (p) => ts.sys.readFile(p));
    if (read.error) throw new Error(ts.flattenDiagnosticMessageText(read.error.messageText, '\n'));
    return ts.parseJsonConfigFileContent(read.config, ts.sys, repoRoot, undefined, configPath);
  }

  const host: ts.LanguageServiceHost = {
    getScriptFileNames: () => parsed.fileNames,
    getScriptVersion: (fileName) => String(versions.get(fileName) ?? fileMtime(fileName)),
    getScriptSnapshot: (fileName) => {
      if (!fs.existsSync(fileName)) return undefined;
      return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName, 'utf8'));
    },
    getCurrentDirectory: () => repoRoot,
    getCompilationSettings: () => parsed.options,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    fileExists: (p) => ts.sys.fileExists(p),
    readFile: (p) => ts.sys.readFile(p),
    readDirectory: (...args) => ts.sys.readDirectory(...args),
    directoryExists: (p) => ts.sys.directoryExists(p),
    getDirectories: (p) => ts.sys.getDirectories(p),
  };

  function fileMtime(fileName: string): number {
    try {
      return fs.statSync(fileName).mtimeMs;
    } catch {
      return 0;
    }
  }

  const service = ts.createLanguageService(host, ts.createDocumentRegistry());

  const toCategory = (c: ts.DiagnosticCategory): StudioDiagnostic['category'] =>
    c === ts.DiagnosticCategory.Error
      ? 'error'
      : c === ts.DiagnosticCategory.Warning
        ? 'warning'
        : c === ts.DiagnosticCategory.Suggestion
          ? 'suggestion'
          : 'message';

  return {
    invalidate(absFile) {
      versions.set(absFile, Date.now());
      // New files must be picked up by the file list.
      parsed = loadConfig();
    },
    check(absFiles) {
      const targets = absFiles.length > 0 ? absFiles : parsed.fileNames;
      const out: StudioDiagnostic[] = [];
      for (const file of targets) {
        if (!parsed.fileNames.includes(file)) parsed = loadConfig();
        const diags = [...service.getSyntacticDiagnostics(file), ...service.getSemanticDiagnostics(file)];
        for (const d of diags) {
          const sf = d.file;
          const start = sf && d.start !== undefined ? sf.getLineAndCharacterOfPosition(d.start) : { line: 0, character: 0 };
          const end =
            sf && d.start !== undefined ? sf.getLineAndCharacterOfPosition(d.start + (d.length ?? 0)) : start;
          out.push({
            file: path.relative(repoRoot, sf?.fileName ?? file).split(path.sep).join('/'),
            line: start.line + 1,
            column: start.character + 1,
            endLine: end.line + 1,
            endColumn: end.character + 1,
            message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
            category: toCategory(d.category),
            code: d.code,
          });
        }
      }
      return out;
    },
  };
}
