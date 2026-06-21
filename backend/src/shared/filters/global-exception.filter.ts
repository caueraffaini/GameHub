import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let displayMessage = 'An unexpected error occurred';
    let details: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resBody = exception.getResponse();
      
      if (typeof resBody === 'object' && resBody !== null) {
        displayMessage = (resBody as any).message || exception.message;
        if (Array.isArray(displayMessage)) {
          details = displayMessage;
          displayMessage = 'Validation failed';
        }
        errorCode = (resBody as any).error || HttpStatus[status] || 'HTTP_ERROR';
      } else {
        displayMessage = exception.message;
        errorCode = HttpStatus[status] || 'HTTP_ERROR';
      }
    } else if (exception instanceof Error) {
      displayMessage = exception.message;
      errorCode = exception.name || 'ERROR';
    }

    response.status(status).send({
      errorCode: String(errorCode).toUpperCase().replace(/\s+/g, '_'),
      displayMessage,
      timestamp: new Date().toISOString(),
      details,
    });
  }
}
