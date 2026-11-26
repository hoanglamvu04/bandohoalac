import { asyncHandler } from '../utils/asyncHandler.js';
import { createHousingViewing, listHousingViewings, manageHousingViewing } from '../services/housingViewings.service.js';
function privateResponse(res) { res.set('Cache-Control','private, no-store'); res.vary('Authorization'); }
export const createViewing=asyncHandler(async(req,res)=>{
  privateResponse(res);
  res.status(201).json({item:await createHousingViewing(req.params.placeId,req.user.id,req.body.startsAt)});
});
export const listViewings=asyncHandler(async(req,res)=>{
  privateResponse(res); res.json({items:await listHousingViewings(req.user.id)});
});
export const manageViewing=asyncHandler(async(req,res)=>{
  privateResponse(res); res.json({item:await manageHousingViewing(req.params.id,req.user.id,req.body.action)});
});
