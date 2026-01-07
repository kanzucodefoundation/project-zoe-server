import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AppLogger } from '../utils/app-logger.service';

@Injectable()
export class PerformanceMonitoringInterceptor implements NestInterceptor {
  constructor(private readonly appLogger: AppLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const method = request.method;
    const url = request.url;
    const userAgent = request.get('User-Agent') || '';
    const user = request.user;
    const ip = request.ip;

    // Extract route parameters for better context
    const routeHandler = context.getHandler().name;
    const controllerName = context.getClass().name;

    const logContext = {
      userId: user?.id,
      contactId: user?.contactId,
      operation: `${controllerName}.${routeHandler}`,
      resource: this.extractResourceFromUrl(url),
      requestId: request.headers['x-request-id'] || this.generateRequestId(),
      metadata: {
        method,
        url,
        userAgent,
        ip,
        controller: controllerName,
        handler: routeHandler,
      },
    };

    // Log request start
    this.appLogger.apiLog(
      'log',
      `API Request started: ${method} ${url}`,
      logContext,
    );

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;

          // Determine log level based on performance
          const logLevel = this.getLogLevelForPerformance(duration, statusCode);

          this.appLogger.performanceLog(logLevel, {
            ...logContext,
            duration,
            operation: `${method} ${url}`,
            success: statusCode >= 200 && statusCode < 300,
            metadata: {
              ...logContext.metadata,
              statusCode,
              responseSize: this.getResponseSize(data),
              performanceCategory: this.categorizePerformance(duration),
            },
          });

          // Log slow requests with more detail
          if (duration > 5000) {
            this.appLogger.performanceLog('warn', {
              ...logContext,
              duration,
              operation: `SLOW REQUEST: ${method} ${url}`,
              success: statusCode >= 200 && statusCode < 300,
              metadata: {
                ...logContext.metadata,
                statusCode,
                warning: 'Request exceeded 5 seconds',
                investigation_needed: true,
              },
            });
          }
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode || 500;

          this.appLogger.errorLog(error, {
            ...logContext,
            duration,
            metadata: {
              ...logContext.metadata,
              statusCode,
              errorType: error.constructor.name,
              performanceCategory: this.categorizePerformance(duration),
            },
          });

          this.appLogger.performanceLog('error', {
            ...logContext,
            duration,
            operation: `${method} ${url}`,
            success: false,
            metadata: {
              ...logContext.metadata,
              statusCode,
              error: error.message,
            },
          });
        },
      }),
    );
  }

  private getLogLevelForPerformance(
    duration: number,
    statusCode: number,
  ): 'error' | 'warn' | 'log' | 'debug' | 'verbose' {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    if (duration > 5000) return 'warn';
    if (duration > 1000) return 'log';
    if (duration > 500) return 'debug';
    return 'verbose';
  }

  private categorizePerformance(duration: number): string {
    if (duration < 100) return 'excellent';
    if (duration < 300) return 'good';
    if (duration < 1000) return 'acceptable';
    if (duration < 3000) return 'slow';
    if (duration < 5000) return 'very_slow';
    return 'critical';
  }

  private getResponseSize(data: any): number {
    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }

  private extractResourceFromUrl(url: string): string {
    // Extract main resource from URL path
    const segments = url
      .split('/')
      .filter((segment) => segment && segment !== 'api');
    return segments[0] || 'unknown';
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
