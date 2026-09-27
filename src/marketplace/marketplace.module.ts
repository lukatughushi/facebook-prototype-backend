import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MarketplaceItem, MarketplaceItemSchema } from './schemas/marketplace-item.schema';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: MarketplaceItem.name, schema: MarketplaceItemSchema }])],
  controllers: [MarketplaceController],
  providers: [MarketplaceService],
  exports: [MongooseModule, MarketplaceService],
})
export class MarketplaceModule {}
