import type { MigrationMetadata, MigrationMetadataFinished } from '@emigrate/types';
import { indent } from '../indent.js';
import { style } from '../style.js';
import { getAbortMessage, getError, getMigrationText, getSummary, getTitle } from './ui.js';

const newLine = () => {
  console.log('');
};

export class NewCommandReporter {
  onInit(parameters: { version: string; cwd: string }): void {
    newLine();
    console.log(getTitle({ ...parameters, command: 'new', dry: false }));
    newLine();
  }

  onAbort(reason: Error): void {
    console.error(getAbortMessage(reason));
    newLine();
  }

  onNewMigration(migration: MigrationMetadata, content: string): void {
    console.log('\n  About to write to', `${getMigrationText('new', migration).trim()}:`);
    newLine();
    console.log(
      content
        ? indent(style.cyan(content))
        : style.cyan(
            style.dim(`  <No content>
`),
          ),
    );
  }

  onMigrationSuccess(migration: MigrationMetadataFinished): void {
    newLine();
    console.log(getMigrationText('new', migration));
  }

  onMigrationError(migration: MigrationMetadataFinished, _error: Error): void {
    newLine();
    console.error(getMigrationText('new', migration));
  }

  onMigrationSkip(migration: MigrationMetadataFinished): void {
    newLine();
    console.log(getMigrationText('new', migration));
  }

  onFinished(migrations: MigrationMetadataFinished[], error?: Error | undefined): void {
    if (migrations.length > 0) {
      newLine();
      console.log(getSummary('new', migrations));
      newLine();
    }

    if (error) {
      console.error(getError(error));
      newLine();
    }
  }
}

export const newCommandReporter: NewCommandReporter = new NewCommandReporter();
