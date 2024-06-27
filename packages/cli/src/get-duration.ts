import process from 'node:process';

export const getDuration = (start: [number, number]): number => {
  const [seconds, nanoseconds] = process.hrtime(start);
  return seconds * 1000 + nanoseconds / 1_000_000;
};
