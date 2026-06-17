import { AppError } from '../../shared/errors/AppError';
import { User } from '../users/user.model';
import { Conversation } from '../messages/conversation.model';
import { Appeal } from './appeal.model';
import { Report } from './report.model';

export async function createReport(input: {
  reporterId: string;
  reportedUserId: string;
  conversationId?: string | null;
  reason: string;
}) {
  const reason = input.reason.trim();
  if (!reason) {
    throw new AppError(422, 'Please describe the issue', 'REPORT_REASON_REQUIRED');
  }

  if (input.reporterId === input.reportedUserId) {
    throw new AppError(422, 'You cannot report yourself', 'INVALID_REPORT');
  }

  const reported = await User.findById(input.reportedUserId).select('_id');
  if (!reported) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  let conversationId: string | undefined;
  if (input.conversationId) {
    const conversation = await Conversation.findById(input.conversationId).select('participants');
    if (conversation && conversation.participants.some((id) => id.toString() === input.reporterId)) {
      conversationId = conversation._id.toString();
    }
  }

  const report = await Report.create({
    reporter: input.reporterId,
    reportedUser: input.reportedUserId,
    conversation: conversationId,
    reason,
  });

  return { id: report._id.toString(), status: report.status };
}

export async function createAppeal(userId: string, message: string) {
  const trimmed = message.trim();
  if (!trimmed) {
    throw new AppError(422, 'Please explain your appeal', 'APPEAL_MESSAGE_REQUIRED');
  }

  const user = await User.findById(userId).select('suspended');
  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  if (!user.suspended) {
    throw new AppError(422, 'Your account is not suspended', 'NOT_SUSPENDED');
  }

  const existingPending = await Appeal.findOne({ user: userId, status: 'pending' });
  if (existingPending) {
    throw new AppError(409, 'You already have an appeal under review', 'APPEAL_ALREADY_PENDING');
  }

  const appeal = await Appeal.create({ user: userId, message: trimmed });

  return { id: appeal._id.toString(), status: appeal.status };
}

export async function getMyLatestAppeal(userId: string) {
  const appeal = await Appeal.findOne({ user: userId }).sort({ createdAt: -1 });

  if (!appeal) {
    return { appeal: null };
  }

  return {
    appeal: {
      id: appeal._id.toString(),
      message: appeal.message,
      status: appeal.status,
      createdAt: appeal.createdAt.toISOString(),
      reviewedAt: appeal.reviewedAt?.toISOString() ?? null,
    },
  };
}
