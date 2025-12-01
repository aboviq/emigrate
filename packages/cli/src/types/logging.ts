import type { ConsoleFormatter, TextFormatter } from '@logtape/logtape';

export type { Logger, Config as LoggingConfig, LogLevel, Sink as LogSink } from '@logtape/logtape';

export type LogFormatter = ConsoleFormatter | TextFormatter;
