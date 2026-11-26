import { z } from 'zod';
export const catalogServiceSchema=z.object({
 title:z.string().trim().min(2).max(120),
 description:z.string().trim().max(500).default(''),
 priceVnd:z.number().int().min(0).max(100000000000).nullable()
}).strict();
export const serviceAvailabilitySchema=z.object({active:z.boolean()}).strict();
export const serviceAppointmentSchema=z.object({
 startsAt:z.string().max(32)
}).strict();
export const serviceAppointmentActionSchema=z.object({action:z.enum(['ACCEPT','DECLINE','CANCEL'])}).strict();
