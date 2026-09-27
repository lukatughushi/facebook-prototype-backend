import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

// Cover photo vertical focus in percent (0 = top, 100 = bottom). Optional on
// the multipart cover upload, required for PATCH /users/cover-position.
export class CoverPositionDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  position?: number;
}
