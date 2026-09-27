import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CONDITIONS, Condition, MARKET_CATEGORIES, MarketCategory } from '../schemas/marketplace-item.schema';

// Sent as multipart/form-data (with up to 5 `images`), so numbers arrive as
// strings and are converted by class-transformer.
export class CreateListingDto {
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  @MaxLength(100)
  title: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'Price must be a number' })
  @Min(0)
  @Max(100_000_000)
  price: number;

  @IsIn(MARKET_CATEGORIES)
  category: MarketCategory;

  @IsOptional()
  @IsIn(CONDITIONS)
  condition?: Condition;

  @IsString()
  @IsNotEmpty({ message: 'Location is required' })
  @MaxLength(100)
  location: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class UpdateStatusDto {
  @IsIn(['available', 'sold'])
  status: 'available' | 'sold';
}
