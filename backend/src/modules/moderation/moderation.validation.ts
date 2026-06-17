import { z } from 'zod';

export const createReportSchema = z.object({
  reportedUserId: z.string().min(1),
  conversationId: z.string().min(1).optional(),
  reason: z.string().trim().min(1, 'Please describe the issue').max(2000),
});

export const createAppealSchema = z.object({
  message: z.string().trim().min(1, 'Please explain your appeal').max(2000),
});
