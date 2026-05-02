import winston from 'winston';

const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: isProd
    ? winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      )
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.printf((info) => {
          const { timestamp, level, message, stack, ...rest } = info as unknown as {
            timestamp: string;
            level: string;
            message: string;
            stack?: string;
          } & Record<string, unknown>;

          const meta =
            rest && Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';

          return `${timestamp} [${level}] ${message}${stack ? `\n${stack}` : ''}${meta}`;
        }),
      ),
  defaultMeta: { service: 'hiring-platform-backend' },
  transports: [new winston.transports.Console()],
});

export default logger;

