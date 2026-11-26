import { z } from 'zod';

export const PROPERTY_SUBTYPE_PARENT = Object.freeze({
  ROOM:'HOUSE', MINI_APARTMENT:'APARTMENT', HOMESTAY:'HOUSE',
  TOWNHOUSE:'HOUSE', DETACHED_HOUSE:'HOUSE', RESIDENTIAL_LAND:'LAND',
  AGRICULTURAL_LAND:'LAND', APARTMENT_UNIT:'APARTMENT',
  VILLA:'VILLA', RETAIL:'COMMERCIAL', OFFICE:'COMMERCIAL', WAREHOUSE:'COMMERCIAL'
});
export const propertyDetailsSchema = z.object({
  subtype:z.enum(Object.keys(PROPERTY_SUBTYPE_PARENT)).optional(),
  floors:z.number().int().min(1).max(100).optional(),
  bedrooms:z.number().int().min(0).max(100).optional(),
  bathrooms:z.number().int().min(0).max(100).optional(),
  frontageM:z.number().finite().positive().max(1000).optional(),
  accessWidthM:z.number().finite().positive().max(100).optional(),
  direction:z.enum(['N','NE','E','SE','S','SW','W','NW']).optional(),
  legalClaim:z.enum(['CERTIFICATE_REPORTED','PENDING_REPORTED','OTHER_REPORTED']).optional(),
  furnishing:z.enum(['NONE','BASIC','FULL']).optional(),
  maxOccupants:z.number().int().min(1).max(100).optional()
}).strict();

export function validatePropertyDetails(value,ctx){
  const d=value.details;
  if(!d)return;
  const issue=key=>ctx.addIssue({code:'custom',path:['details',key],message:'Thông tin không phù hợp với loại bất động sản.'});
  if(d.subtype&&PROPERTY_SUBTYPE_PARENT[d.subtype]!==value.propertyType)issue('subtype');
  if(value.propertyType==='LAND')for(const key of ['floors','bedrooms','bathrooms','furnishing','maxOccupants'])if(d[key]!==undefined)issue(key);
  if(value.transactionType==='SALE'&&d.maxOccupants!==undefined)issue('maxOccupants');
}
