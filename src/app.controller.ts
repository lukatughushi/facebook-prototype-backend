import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Controller()
export class AppController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  // Also reports which database the API is reading and how much is in it, so a
  // deployment pointed at the wrong (empty) database is obvious at a glance.
  @Get('health')
  async health() {
    const db = this.connection.db;
    const count = (name: string) => (db ? db.collection(name).estimatedDocumentCount() : Promise.resolve(0));
    const [users, posts, reels] = await Promise.all([count('users'), count('posts'), count('reels')]);
    return {
      status: 'ok',
      database: this.connection.name,
      connected: this.connection.readyState === 1,
      counts: { users, posts, reels },
    };
  }
}
