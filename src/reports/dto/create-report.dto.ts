import { IsIn, IsMongoId, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { REPORT_CONTENT_TYPES, REPORT_PARENT_TYPES, REPORT_REASONS } from '../schemas/report.schema';

export class CreateReportDto {
  @IsIn(REPORT_CONTENT_TYPES, { message: 'Unknown content type' })
  contentType: (typeof REPORT_CONTENT_TYPES)[number];

  @IsMongoId({ message: 'Invalid target id' })
  targetId: string;

  @IsIn(REPORT_REASONS, { message: 'Pick a reason for your report' })
  reason: (typeof REPORT_REASONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  // Comment reports: the post/reel the comment belongs to.
  @IsOptional()
  @IsIn(REPORT_PARENT_TYPES)
  parentType?: (typeof REPORT_PARENT_TYPES)[number];

  @ValidateIf((o) => !!o.parentType)
  @IsMongoId({ message: 'Invalid parent id' })
  parentId?: string;
}
