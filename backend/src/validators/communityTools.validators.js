import { z } from 'zod';
const positiveId=z.string().regex(/^[1-9]\d{0,14}$/);
const unit=z.object({
 label:z.string().trim().min(2).max(60).refine(v=>!/[\r\n<>]/.test(v)),
 areaM2:z.number().min(1).max(99999.99).refine(v=>Math.abs(v*100-Math.round(v*100))<1e-6),
 monthlyRentVnd:z.number().int().min(1).max(100000000),
 depositVnd:z.number().int().min(0).max(100000000).nullable(),
 totalRooms:z.number().int().min(1).max(10000),
 availableRooms:z.number().int().min(0).max(10000)
}).strict().refine(v=>v.availableRooms<=v.totalRooms,'Số phòng trống không vượt tổng số phòng.');
export const roomTypesSchema=z.array(unit).min(1).max(20).superRefine((types,ctx)=>{
 const names=new Set();
 for(const x of types){const n=x.label.normalize('NFC').toLocaleLowerCase('vi-VN');if(names.has(n))ctx.addIssue({code:'custom',message:'Tên loại phòng bị trùng.'});names.add(n);}
 if(types.reduce((n,x)=>n+x.totalRooms,0)>10000)ctx.addIssue({code:'custom',message:'Tổng số phòng vượt giới hạn.'});
});
export const roomProposalSchema=z.object({baseVersion:z.number().int().min(0).max(2147483646),types:roomTypesSchema}).strict();
export const roomReviewSchema=z.object({action:z.enum(['APPROVE','REJECT'])}).strict();
export const qaPostSchema=z.object({parentId:positiveId.nullable().optional(),body:z.string().trim().min(10).max(1200)}).strict();
export const qaReportSchema=z.object({reason:z.enum(['SPAM','WRONG_INFO','PRIVATE_INFO','ABUSE'])}).strict();
export const qaReviewSchema=z.object({action:z.enum(['APPROVE','REJECT','ARCHIVE','DISMISS_REPORTS'])}).strict();
