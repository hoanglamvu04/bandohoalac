import {z} from 'zod';
export const advertiserRequestSchema=z.object({}).strict();
export const advertiserReviewSchema=z.object({action:z.enum(['APPROVE','REJECT','REVOKE']),checkedIdentity:z.boolean().optional(),checkedRole:z.boolean().optional()}).strict().refine(v=>v.action!=='APPROVE'||(v.checkedIdentity===true&&v.checkedRole===true),'Phải kiểm tra người đăng và vai trò thực tế trước khi duyệt.');
const iso=z.string().refine(v=>{const d=new Date(v);return Number.isFinite(d.getTime())&&d.toISOString()===v;},'Thời gian không hợp lệ.');
export const eventProposalSchema=z.object({
 title:z.string().trim().min(5).max(120),
 description:z.string().trim().min(10).max(1000),
 sourceUrl:z.string().trim().max(500).refine(v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&u.hostname.includes('.');}catch{return false;}},'Cần URL HTTPS công khai, không chứa thông tin đăng nhập hoặc tham số riêng tư.'),
 startsAt:iso,endsAt:iso
}).strict().refine(v=>Date.parse(v.endsAt)>Date.parse(v.startsAt)&&Date.parse(v.endsAt)-Date.parse(v.startsAt)<=7*86400000,'Sự kiện kéo dài tối đa 7 ngày.');
export const eventReviewSchema=z.object({action:z.enum(['APPROVE','REJECT','REVOKE']),checkedSource:z.boolean().optional()}).strict().refine(v=>v.action!=='APPROVE'||v.checkedSource===true,'Phải kiểm tra nguồn, địa điểm và thời gian trước khi duyệt.');
