/**
 * Level-gated console wrapper. `debug` is silent in production builds;
 * `warn`/`error` always surface since they indicate something a user or
 * operator may need to act on.
 */
const isProd = import.meta.env.PROD;

function debug(...args: unknown[]): void {
  if (!isProd) {
    console.log(...args);
  }
}

function warn(...args: unknown[]): void {
  console.warn(...args);
}

function error(...args: unknown[]): void {
  console.error(...args);
}

export const logger = { debug, warn, error };
