import { AppError } from '../utils/AppError.js';

const MAX_BIGINT=9223372036854775807n;
const ISO_MICROS=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
function validBoundary(value){
 if(!value||typeof value!=='object'||value.v!==1||typeof value.t!=='string'||!ISO_MICROS.test(value.t)||
    typeof value.id!=='string'||!/^[1-9]\d{0,18}$/.test(value.id)||BigInt(value.id)>MAX_BIGINT)return false;
 const d=new Date(value.t.slice(0,23)+'Z');
 return Number.isFinite(d.getTime())&&d.toISOString()===value.t.slice(0,23)+'Z';
}
// Cursor is a boundary, NOT a credential. All queries independently check the
// authenticated owner. Preserve the DB's microsecond timestamp and bigint ID.
export function encodeOwnerListingCursor(createdAt,id){
 const value={v:1,t:createdAt,id:String(id)};
 if(!validBoundary(value))throw new Error('Invalid owner listing boundary.');
 return Buffer.from(JSON.stringify(value),'utf8').toString('base64url');
}
export function decodeOwnerListingCursor(value){
 try{
  if(typeof value!=='string'||value.length>160||!/^[A-Za-z0-9_-]+$/.test(value))throw Error();
  const buffer=Buffer.from(value,'base64url');
  if(buffer.toString('base64url')!==value)throw Error();
  const x=JSON.parse(buffer.toString('utf8'));
  if(!validBoundary(x)||Object.keys(x).length!==3)throw Error();
  return {createdAt:x.t,id:x.id};
 }catch{throw new AppError('Con trỏ phân trang không hợp lệ. Hãy tải lại trang đầu.',400);}
}
export function ownerListingPageLimit(value=50){
 const n=typeof value==='number'?value:typeof value==='string'&&/^[1-9]\d{0,2}$/.test(value)?Number(value):NaN;
 if(!Number.isInteger(n)||n<1||n>100)throw new AppError('Giới hạn trang phải từ 1 đến 100.',400);
 return n;
}
