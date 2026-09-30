import { z } from 'zod';

const contributionType = z.enum([
  'CREATE_PLACE',
  'UPDATE_PLACE',
  'ADD_PHOTO',
  'FIX_LOCATION',
  'UPDATE_HOURS',
  'UPDATE_PRICE',
  'REPORT_CLOSED',
  'REPORT_WRONG_INFO'
]);

const nullableDate = z.union([z.string().datetime({ offset: true }), z.null()]);

const missionFields = {
  title: z.string().trim().min(2).max(180).optional(),
  description: z.string().trim().max(1600).nullable().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ENDED']).optional(),
  contributionTypes: z.array(contributionType).max(8).optional(),
  targetCount: z.coerce.number().int().min(1).max(100000).optional(),
  bonusPoints: z.coerce.number().int().min(0).max(100000).optional(),
  completionBonus: z.coerce.number().int().min(0).max(1000000).optional(),
  startsAt: nullableDate.optional(),
  endsAt: nullableDate.optional()
};

function validateDates(data, ctx) {
  if (data.startsAt && data.endsAt && new Date(data.endsAt) < new Date(data.startsAt)) {
    ctx.addIssue({
      code: 'custom',
      path: ['endsAt'],
      message: 'endsAt must be after startsAt.'
    });
  }
}

export const createMissionSchema = z.object({
  ...missionFields,
  title: z.string().trim().min(2).max(180),
  targetCount: z.coerce.number().int().min(1).max(100000)
}).superRefine(validateDates);

export const updateMissionSchema = z.object(missionFields).superRefine(validateDates);
