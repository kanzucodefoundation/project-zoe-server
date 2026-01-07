import { Injectable, Logger, LogLevel } from '@nestjs/common';

export interface LogContext {
  userId?: number;
  contactId?: number;
  tenantId?: number;
  requestId?: string;
  operation?: string;
  resource?: string;
  resourceId?: number | string;
  duration?: number;
  timestamp?: string;
  service?: string;
  metadata?: Record<string, any>;
}

export interface PerformanceMetrics {
  startTime: number;
  operation: string;
  context?: LogContext;
}

@Injectable()
export class AppLogger {
  private readonly logger = new Logger();

  /**
   * Start performance tracking for an operation
   */
  startPerformanceTracking(
    operation: string,
    context?: LogContext,
  ): PerformanceMetrics {
    return {
      startTime: Date.now(),
      operation,
      context,
    };
  }

  /**
   * End performance tracking and log the result
   */
  endPerformanceTracking(
    metrics: PerformanceMetrics,
    success: boolean = true,
  ): void {
    const duration = Date.now() - metrics.startTime;
    const level =
      duration > 5000 ? 'warn' : duration > 1000 ? 'log' : 'verbose';

    this.performanceLog(level, {
      operation: metrics.operation,
      duration,
      success,
      ...(metrics.context || {}),
    });
  }

  /**
   * Log authentication events
   */
  authLog(level: LogLevel, message: string, context: LogContext): void {
    this.structuredLog('AUTH', level, message, context);
  }

  /**
   * Log security events (authentication, authorization, access attempts)
   */
  securityLog(level: LogLevel, message: string, context: LogContext): void {
    this.structuredLog('SECURITY', level, message, {
      ...context,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log business operations (CRUD operations, business logic)
   */
  businessLog(level: LogLevel, message: string, context: LogContext): void {
    this.structuredLog('BUSINESS', level, message, context);
  }

  /**
   * Log performance metrics
   */
  performanceLog(
    level: LogLevel,
    context: LogContext & {
      duration: number;
      operation: string;
      success?: boolean;
    },
  ): void {
    const message = `${context.operation} completed in ${context.duration}ms`;
    this.structuredLog('PERFORMANCE', level, message, context);
  }

  /**
   * Log data access operations
   */
  dataAccessLog(level: LogLevel, message: string, context: LogContext): void {
    this.structuredLog('DATA_ACCESS', level, message, context);
  }

  /**
   * Log API requests/responses
   */
  apiLog(level: LogLevel, message: string, context: LogContext): void {
    this.structuredLog('API', level, message, context);
  }

  /**
   * Log cache operations
   */
  cacheLog(level: LogLevel, message: string, context: LogContext): void {
    this.structuredLog('CACHE', level, message, context);
  }

  /**
   * Log errors with full context
   */
  errorLog(error: Error, context: LogContext, serviceName?: string): void {
    const errorContext = {
      ...context,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      service: serviceName,
    };

    this.structuredLog(
      'ERROR',
      'error',
      `Error in ${serviceName || 'Unknown Service'}`,
      errorContext,
    );
  }

  /**
   * Core structured logging method
   */
  private structuredLog(
    category: string,
    level: LogLevel,
    message: string,
    context: LogContext,
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      category,
      level: level.toUpperCase(),
      message,
      ...this.sanitizeContext(context),
    };

    const formattedMessage = this.formatLogMessage(logEntry);

    // Use the appropriate Logger method based on level
    switch (level) {
      case 'error':
        this.logger.error(formattedMessage);
        break;
      case 'warn':
        this.logger.warn(formattedMessage);
        break;
      case 'log':
        this.logger.log(formattedMessage);
        break;
      case 'debug':
        this.logger.debug(formattedMessage);
        break;
      case 'verbose':
        this.logger.verbose(formattedMessage);
        break;
      default:
        this.logger.log(formattedMessage);
    }
  }

  /**
   * Format log message for better readability
   */
  private formatLogMessage(logEntry: any): string {
    const { timestamp, category, level, message, ...context } = logEntry;

    let formatted = `[${timestamp}] [${category}] [${level}] ${message}`;

    // Add key context information inline
    if (context.userId) formatted += ` | User: ${context.userId}`;
    if (context.contactId) formatted += ` | Contact: ${context.contactId}`;
    if (context.tenantId) formatted += ` | Tenant: ${context.tenantId}`;
    if (context.operation) formatted += ` | Op: ${context.operation}`;
    if (context.resource) formatted += ` | Resource: ${context.resource}`;
    if (context.resourceId) formatted += ` | ID: ${context.resourceId}`;
    if (context.duration) formatted += ` | Duration: ${context.duration}ms`;

    // Add additional context as JSON if present
    const additionalContext = this.getAdditionalContext(context);
    if (Object.keys(additionalContext).length > 0) {
      formatted += ` | Context: ${JSON.stringify(additionalContext)}`;
    }

    return formatted;
  }

  /**
   * Extract additional context excluding standard fields
   */
  private getAdditionalContext(context: any): Record<string, any> {
    const standardFields = [
      'userId',
      'contactId',
      'tenantId',
      'requestId',
      'operation',
      'resource',
      'resourceId',
      'duration',
      'success',
    ];
    const additional: Record<string, any> = {};

    Object.keys(context).forEach((key) => {
      if (!standardFields.includes(key)) {
        additional[key] = context[key];
      }
    });

    return additional;
  }

  /**
   * Remove sensitive information from context
   */
  private sanitizeContext(context: LogContext): LogContext {
    const sanitized = { ...context };

    // Remove or mask sensitive fields
    if (sanitized.metadata) {
      const { password, token, secret, ...safeMeta } = sanitized.metadata;
      sanitized.metadata = safeMeta;
    }

    return sanitized;
  }

  /**
   * Create a child logger with default context
   */
  createContextLogger(
    serviceName: string,
    defaultContext: Partial<LogContext> = {},
  ): ContextLogger {
    return new ContextLogger(this, serviceName, defaultContext);
  }
}

/**
 * Context logger that automatically includes service name and default context
 */
export class ContextLogger {
  constructor(
    private appLogger: AppLogger,
    private serviceName: string,
    private defaultContext: Partial<LogContext> = {},
  ) {}

  private mergeContext(context?: LogContext): LogContext {
    return {
      ...this.defaultContext,
      ...context,
      service: this.serviceName,
    };
  }

  auth(level: LogLevel, message: string, context?: LogContext): void {
    this.appLogger.authLog(level, message, this.mergeContext(context));
  }

  security(level: LogLevel, message: string, context?: LogContext): void {
    this.appLogger.securityLog(level, message, this.mergeContext(context));
  }

  business(level: LogLevel, message: string, context?: LogContext): void {
    this.appLogger.businessLog(level, message, this.mergeContext(context));
  }

  dataAccess(level: LogLevel, message: string, context?: LogContext): void {
    this.appLogger.dataAccessLog(level, message, this.mergeContext(context));
  }

  api(level: LogLevel, message: string, context?: LogContext): void {
    this.appLogger.apiLog(level, message, this.mergeContext(context));
  }

  cache(level: LogLevel, message: string, context?: LogContext): void {
    this.appLogger.cacheLog(level, message, this.mergeContext(context));
  }

  performance(
    level: LogLevel,
    context: LogContext & {
      duration: number;
      operation: string;
      success?: boolean;
    },
  ): void {
    this.appLogger.performanceLog(level, {
      ...this.mergeContext(context),
      ...context,
    });
  }

  error(error: Error, context?: LogContext): void {
    this.appLogger.errorLog(
      error,
      this.mergeContext(context),
      this.serviceName,
    );
  }

  startTracking(operation: string, context?: LogContext): PerformanceMetrics {
    return this.appLogger.startPerformanceTracking(
      operation,
      this.mergeContext(context),
    );
  }

  endTracking(metrics: PerformanceMetrics, success: boolean = true): void {
    this.appLogger.endPerformanceTracking(metrics, success);
  }
}
