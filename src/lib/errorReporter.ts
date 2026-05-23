type ErrorReport = Record<string, unknown>;

export const errorReporter = {
  report(_error: ErrorReport): void {},
  reportWarning(_message: string, _context?: Record<string, unknown>): void {},
  reportInfo(_message: string, _context?: Record<string, unknown>): void {},
};

export default errorReporter;
