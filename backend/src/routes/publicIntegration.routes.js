import { Router } from 'express';
import {
  getPublicApiMeta,
  getPublicCategories,
  getPublicMapConfig,
  getPublicMapStyle,
  getPublicNearbyPlaces,
  getPublicOpenApi,
  getPublicPlaceById,
  getPublicPlaceBySlug,
  getPublicPlaces,
  getPublicPlacesBounds,
  getPublicPlacesGeoJson
} from '../controllers/publicIntegration.controller.js';
import { validateQuery } from '../validators/validate.js';
import {
  publicBoundsQuerySchema,
  publicNearbyQuerySchema,
  publicPlacesQuerySchema
} from '../validators/publicIntegration.validators.js';

const router = Router();

router.get('/', getPublicApiMeta);
router.get('/meta', getPublicApiMeta);
router.get('/openapi.json', getPublicOpenApi);
router.get('/map/config', getPublicMapConfig);
router.get('/map/style.json', getPublicMapStyle);
router.get('/categories', getPublicCategories);
router.get('/places/bounds', validateQuery(publicBoundsQuerySchema), getPublicPlacesBounds);
router.get('/places/geojson', validateQuery(publicBoundsQuerySchema), getPublicPlacesGeoJson);
router.get('/places/nearby', validateQuery(publicNearbyQuerySchema), getPublicNearbyPlaces);
router.get('/places/slug/:slug', getPublicPlaceBySlug);
router.get('/places/:id', getPublicPlaceById);
router.get('/places', validateQuery(publicPlacesQuerySchema), getPublicPlaces);

export default router;
