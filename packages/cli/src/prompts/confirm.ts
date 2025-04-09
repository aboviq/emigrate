import readline from 'node:readline/promises';
import process from 'node:process';
import { dim } from 'ansis';

export const confirm = async (message: string, defaultValue = true, abortSignal?: AbortSignal): Promise<boolean> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.on('SIGINT', () => {
    rl.close();
    process.emit('SIGINT');
  });

  try {
    const answer = await rl.question(`${message} ${dim`[${defaultValue ? 'Y/n' : 'y/N'}]`} `, { signal: abortSignal });

    console.log('');

    const defaultAnswer = defaultValue ? 'y' : 'n';

    return /^y(es)?$/i.test(answer.trim() || defaultAnswer);
  } catch (error) {
    if ((error instanceof Error && error.cause === abortSignal?.reason) || error === abortSignal?.reason) {
      return false;
    }

    throw error;
  } finally {
    rl.close();
  }
};
