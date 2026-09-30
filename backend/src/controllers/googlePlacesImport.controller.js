import { asyncHandler } from '../utils/asyncHandler.js';
import { previewGooglePlaceImport } from '../services/googlePlacesImport.service.js';

export const previewGooglePlaceImportAdmin = asyncHandler(async (req, res) => {
  const data = await previewGooglePlaceImport(req.body.input);
  res.json(data);
});
