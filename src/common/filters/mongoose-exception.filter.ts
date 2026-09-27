import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { Error as MongooseError } from 'mongoose';

// A malformed id in a URL (e.g. /api/users/abc) makes Mongoose throw a
// CastError, and a document that fails schema rules throws a
// ValidationError. Without this filter both surface as 500s; they are
// client errors, so answer 400 with a readable message instead.
@Catch(MongooseError.CastError, MongooseError.ValidationError)
export class MongooseExceptionFilter implements ExceptionFilter {
  catch(exception: MongooseError.CastError | MongooseError.ValidationError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const message =
      exception instanceof MongooseError.CastError
        ? `Invalid ${exception.path === '_id' ? 'id' : exception.path}`
        : Object.values(exception.errors)
            .map((e) => e.message)
            .join(', ');
    res.status(400).json({ statusCode: 400, message, error: 'Bad Request' });
  }
}
