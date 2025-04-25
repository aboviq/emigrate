import type { MigrationMetadata, MigrationMetadataFinished, ReporterInitParameters } from '@emigrate/types';
import { cyan } from 'ansis';
import { getAbortMessage, getError, getMigrationText, getSummary, getTitle } from './ui.js';

const indent = (text: string, indentation = '  ') => `${indentation}${text.split('\n').join(`\n${indentation}`)}`;

export class NewCommandReporter {
  onInit(parameters: ReporterInitParameters): void {
    console.log('');
    console.log(getTitle(parameters));
    console.log('');
  }

  onAbort(reason: Error): void {
    console.log('');
    console.error(getAbortMessage(reason));
  }

  onNewMigration(migration: MigrationMetadata, content: string): void {
    console.log('  About to write to', `${getMigrationText('new', migration).trim()}:`);
    console.log('');
    console.log(
      content
        ? indent(cyan(content))
        : cyan.faint`  <No content>
`,
    );
  }

  onMigrationSuccess(migration: MigrationMetadataFinished): void {
    console.log(getMigrationText('new', migration));
  }

  onMigrationError(migration: MigrationMetadataFinished, _error: Error): void {
    console.error(getMigrationText('new', migration));
  }

  onMigrationSkip(migration: MigrationMetadataFinished): void {
    console.log(getMigrationText('new', migration));
  }

  onFinished(migrations: MigrationMetadataFinished[], error?: Error | undefined): void {
    if (migrations.length > 0) {
      console.log('');
      console.log(getSummary('new', migrations));
      console.log('');
    }

    if (error) {
      console.error(getError(error));
      console.log('');
    }
  }
}

export const newCommandReporter: NewCommandReporter = new NewCommandReporter();
