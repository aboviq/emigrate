import type { LogFormatter, LogLevel, LogSink } from './logging.js';
import type { EmigratePlugin } from './plugins.js';
import type { Simplify } from './simplify.js';
import type { EmigrateStorage } from './storage.js';
import type { Awaitable, StringOrModule } from './utils.js';

export type EmigrateBaseConfig = {
  /**
   * Storage configuration
   *
   * See {@link EmigrateStorage} for details.
   *
   * Must be provided either in the config or via a plugin.
   */
  storage: Awaitable<EmigrateStorage>;

  /**
   * Plugins to load
   *
   * Each plugin can be specified as:
   * - A string module specifier that resolves to an EmigratePlugin
   * - An EmigratePlugin object
   * - `false`, `null`, or `undefined` to skip loading a plugin (useful for conditional loading)
   *
   * See {@link EmigratePlugin} for details.
   */
  plugins: Array<StringOrModule<EmigratePlugin | false | null | undefined>>;

  /**
   * The log level for the CLI output
   *
   * @default 'info'
   */
  logLevel: LogLevel | null;

  /**
   * The log formatter to use for the CLI output
   *
   * If not provided or `null`, Emigrate's default formatter will be used.
   */
  logFormatter: LogFormatter | null;

  /**
   * The log sink to use for the CLI output
   *
   * If not provided or `null`, Emigrate's default sink (the console) will be used.
   *
   * If both `logFormatter` and `logSink` are provided, the formatter has no effect.
   */
  logSink: LogSink | null;

  /**
   * Whether to use color in the CLI output
   *
   * Defaults to `true` if the terminal supports it.
   */
  color: boolean;

  /**
   * The number of seconds to wait before abandoning running migrations after the command has been aborted
   */
  abortRespite: number;
};

export type EmigrateResolvedBaseConfig = {
  /**
   * Storage configuration
   *
   * See {@link EmigrateStorage} for details.
   */
  storage: EmigrateStorage;

  /**
   * Loaded plugins
   *
   * See {@link EmigratePlugin} for details.
   */
  plugins: Array<EmigratePlugin>;

  /**
   * The log level for the CLI output
   */
  logLevel: LogLevel;

  /**
   * Whether to use color in the CLI output
   */
  color: boolean;

  /**
   * The number of seconds to wait before abandoning running migrations after the command has been aborted
   */
  abortRespite: number;
};

export type EmigrateCommand = 'up' | 'dry-run' | 'log' | 'remove' | 'list';

export type EmigrateConfig = Simplify<Partial<EmigrateBaseConfig> & Emigrate.AdditionalConfig>;

export type EmigrateResolvedConfig = Simplify<EmigrateResolvedBaseConfig & Emigrate.AdditionalConfig>;
