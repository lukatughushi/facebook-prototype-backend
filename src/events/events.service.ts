import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserDocument } from '../users/schemas/user.schema';
import { Event, EventDocument } from './schemas/event.schema';
import { CreateEventDto } from './dto/create-event.dto';

const PERSON = 'name avatar';
// Events stay listed for a few hours after they start.
const LIST_GRACE_MS = 6 * 60 * 60 * 1000;
const has = (ids: Types.ObjectId[] = [], id: string) => ids.some((x) => x.toString() === id);
const idOf = (user: UserDocument) => (user as any)._id.toString();

@Injectable()
export class EventsService {
  constructor(@InjectModel(Event.name) private eventModel: Model<EventDocument>) {}

  // Client shape: going count + whether the viewer is going / hosting.
  private shape(e: EventDocument, viewerId: string) {
    const host = e.host as any;
    return {
      _id: e._id,
      title: e.title,
      description: e.description,
      location: e.location,
      startsAt: e.startsAt,
      coverImage: e.coverImage,
      host: host?._id ? { _id: host._id, name: host.name, avatar: host.avatar } : host,
      goingCount: e.going.length,
      isGoing: has(e.going, viewerId),
      isHost: String(host?._id ?? host) === viewerId,
      createdAt: e.createdAt,
    };
  }

  // Upcoming events, soonest first; `mine` limits to ones you host or attend.
  async list(viewer: UserDocument, opts: { mine?: boolean }) {
    const me = (viewer as any)._id;
    const filter: Record<string, unknown> = { startsAt: { $gte: new Date(Date.now() - LIST_GRACE_MS) } };
    if (opts.mine) filter.$or = [{ host: me }, { going: me }];
    const events = await this.eventModel.find(filter).sort({ startsAt: 1 }).limit(100).populate('host', PERSON);
    return { events: events.map((e) => this.shape(e, idOf(viewer))) };
  }

  async create(viewer: UserDocument, dto: CreateEventDto, coverImage: string) {
    const startsAt = new Date(dto.startsAt);
    if (startsAt.getTime() < Date.now() - 60 * 1000) throw new BadRequestException('Events must start in the future');
    const event = await this.eventModel.create({
      title: dto.title.trim(),
      description: dto.description?.trim() || '',
      location: dto.location?.trim() || '',
      startsAt,
      coverImage,
      host: (viewer as any)._id,
      going: [(viewer as any)._id],
    });
    await event.populate('host', PERSON);
    return { event: this.shape(event, idOf(viewer)) };
  }

  private async findOrThrow(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Event not found');
    const event = await this.eventModel.findById(id);
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  // Toggles the viewer's "Going" RSVP.
  async toggleGoing(id: string, viewer: UserDocument) {
    const event = await this.findOrThrow(id);
    const me = (viewer as any)._id;
    const update = has(event.going, idOf(viewer)) ? { $pull: { going: me } } : { $addToSet: { going: me } };
    const updated = (await this.eventModel.findByIdAndUpdate(id, update, { new: true }).populate('host', PERSON)) as EventDocument;
    return { event: this.shape(updated, idOf(viewer)) };
  }

  async remove(id: string, viewer: UserDocument) {
    const event = await this.findOrThrow(id);
    if (event.host.toString() !== idOf(viewer) && viewer.role !== 'admin') {
      throw new ForbiddenException('Only the host can delete this event');
    }
    await event.deleteOne();
    return { message: 'Event deleted' };
  }
}
