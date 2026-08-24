type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class FrontendLogger {
  private formatMessage(level: LogLevel, context: string, message: string) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [ExpenseSplit:${context}] [${level.toUpperCase()}] ${message}`;
  }

  info(context: string, message: string, data?: any) {
    console.info(this.formatMessage('info', context, message), data ? data : '');
  }

  warn(context: string, message: string, data?: any) {
    console.warn(this.formatMessage('warn', context, message), data ? data : '');
  }

  error(context: string, message: string, data?: any) {
    console.error(this.formatMessage('error', context, message), data ? data : '');
  }

  debug(context: string, message: string, data?: any) {
    if (import.meta.env.DEV) {
      console.debug(this.formatMessage('debug', context, message), data ? data : '');
    }
  }
}

export const logger = new FrontendLogger();
