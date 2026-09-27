import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserDocument } from '../users/schemas/user.schema';
import { Report, ReportDocument } from './schemas/report.schema';
import { CreateReportDto } from './dto/create-report.dto';

const REPORTER = 'name avatar';

@Injectable()
export class ReportsService {
  constructor(@InjectModel(Report.name) private reportModel: Model<ReportDocument>) {}

  // Records a report ticket. Re-reporting the same content while the first
  // ticket is still pending updates it instead of piling up duplicates.
  async create(viewer: UserDocument, dto: CreateReportDto) {
    const key = { reporterId: (viewer as any)._id, contentType: dto.contentType, targetId: dto.targetId, status: 'pending' };
    const report = await this.reportModel.findOneAndUpdate(
      key,
      {
        $set: {
          reason: dto.reason,
          comment: dto.comment?.trim() || '',
          ...(dto.parentType ? { parentType: dto.parentType, parentId: dto.parentId } : {}),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    return {
      message: 'Report submitted. Thank you for keeping our community safe.',
      report: { _id: report._id, contentType: report.contentType, targetId: report.targetId, status: report.status },
    };
  }

  // Admin review queue, newest first, plus per-status totals.
  async list(status?: string) {
    const filter = status === 'pending' || status === 'resolved' ? { status } : {};
    const [reports, pending, resolved] = await Promise.all([
      this.reportModel.find(filter).sort({ createdAt: -1 }).limit(200).populate('reporterId', REPORTER),
      this.reportModel.countDocuments({ status: 'pending' }),
      this.reportModel.countDocuments({ status: 'resolved' }),
    ]);
    return { reports, counts: { pending, resolved } };
  }

  async setStatus(id: string, status: 'pending' | 'resolved') {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Report not found');
    const report = await this.reportModel.findByIdAndUpdate(id, { status }, { new: true }).populate('reporterId', REPORTER);
    if (!report) throw new NotFoundException('Report not found');
    return { report };
  }
}
