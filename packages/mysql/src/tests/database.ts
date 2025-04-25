/* eslint @typescript-eslint/naming-convention:0, import/no-extraneous-dependencies: 0 */
import process from 'node:process';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';

let container: StartedTestContainer | undefined;

export const startDatabase = async (): Promise<{ port: number; host: string }> => {
  if (process.env['CI']) {
    const config = {
      port: process.env['MYSQL_PORT'] ? Number.parseInt(process.env['MYSQL_PORT'], 10) : 3306,
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      host: process.env['MYSQL_HOST'] || 'localhost',
    };

    console.log(`Connecting to MySQL from environment variables: ${JSON.stringify(config)}`);

    return config;
  }

  if (!container) {
    console.log('Starting MySQL container...');
    const containerSetup = new GenericContainer('mysql:8.2')
      .withEnvironment({
        MYSQL_ROOT_PASSWORD: 'admin',
        MYSQL_USER: 'emigrate',
        MYSQL_PASSWORD: 'emigrate',
        MYSQL_DATABASE: 'emigrate',
      })
      .withTmpFs({ '/var/lib/mysql': 'rw' })
      .withCommand(['--sql-mode=NO_ENGINE_SUBSTITUTION', '--default-authentication-plugin=mysql_native_password'])
      .withExposedPorts(3306)
      .withReuse();

    container = await containerSetup.start();

    console.log('MySQL container started');
  }

  return { port: container.getMappedPort(3306), host: container.getHost() };
};

export const stopDatabase = async (): Promise<void> => {
  if (container) {
    console.log('Stopping MySQL container...');
    await container.stop();
    console.log('MySQL container stopped');
    container = undefined;
  }
};
