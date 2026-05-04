// Smoke coverage for DTO/entity runtime classes that primarily exist for validation, reflection, and typing.
import 'reflect-metadata';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { plainToInstance } from 'class-transformer';

type RuntimeClass = new () => unknown;

const sourceRoot = __dirname;
const stringPayload = {
  email: ' STUDENT@EXAMPLE.COM ',
  firstName: ' Ada ',
  hintUnlocked: true,
  lastName: ' Lovelace ',
  moduleId: '1',
  moduleUnitId: '2',
  password: 'Password123!',
  questionContentId: '3',
  questionUnitId: '4',
  sessionId: '11111111-1111-4111-8111-111111111111',
  setId: '22222222-2222-4222-8222-222222222222',
  studentAnswer: { selectedOptionIndex: 1 },
  studentId: '5',
  timeTakenMs: '1500',
};
const nonStringPayload = {
  email: null,
  firstName: 42,
  lastName: 43,
};

function collectRuntimeContractFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      return collectRuntimeContractFiles(fullPath);
    }

    if (
      !entry.endsWith('.ts') ||
      entry.endsWith('.spec.ts') ||
      entry.endsWith('.d.ts')
    ) {
      return [];
    }

    const normalizedPath = fullPath.split('\\').join('/');
    return normalizedPath.includes('/dto/') ||
      normalizedPath.includes('/entities/')
      ? [fullPath]
      : [];
  });
}

describe('DTO and entity runtime contracts', () => {
  const files = collectRuntimeContractFiles(sourceRoot);

  it.each(files.map((file) => [relative(sourceRoot, file), file]))(
    '%s exports constructable runtime classes',
    (_displayPath, file) => {
      const moduleExports = require(file) as Record<string, unknown>;
      const exportedClasses = Object.values(moduleExports).filter(
        (value): value is RuntimeClass =>
          typeof value === 'function' && Boolean(value.prototype),
      );

      expect(exportedClasses.length).toBeGreaterThan(0);

      for (const ExportedClass of exportedClasses) {
        expect(new ExportedClass()).toBeInstanceOf(ExportedClass);
        expect(plainToInstance(ExportedClass, stringPayload)).toBeInstanceOf(
          ExportedClass,
        );
        expect(plainToInstance(ExportedClass, nonStringPayload)).toBeInstanceOf(
          ExportedClass,
        );
      }
    },
  );
});
