import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { findCategoryBySlug } from '../services/category.service.js';
import {
  addPlaceImageAssets,
  createPlace,
  getAdminPlaceImages,
  getPlaceById,
  listAdminPlaces,
  removePlaceImage,
  setPlaceImageCover,
  updatePlaceFields,
  updatePlaceLocation
} from '../services/place.service.js';
import {
  deleteStoredAssets,
  storeUploadedFiles
} from '../services/storage.service.js';

function mapAdminFields(body, categoryId) {
  const fields = {};
  const mapping = {
    name: 'name',
    address: 'address',
    description: 'description',
    phone: 'phone',
    website: 'website',
    priceLevel: 'price_level',
    openingHours: 'opening_hours',
    googlePlaceId: 'google_place_id',
    googleMapsUri: 'google_maps_uri',
    status: 'status'
  };

  for (const [input, column] of Object.entries(mapping)) {
    if (Object.prototype.hasOwnProperty.call(body, input)) {
      fields[column] = body[input] || null;
    }
  }

  if (categoryId !== undefined) fields.category_id = categoryId;

  if (Object.prototype.hasOwnProperty.call(body, 'googlePlaceId')) {
    fields.google_imported_at = body.googlePlaceId ? new Date() : null;
  }

  return fields;
}

async function resolveCategoryId(categorySlug) {
  if (categorySlug === undefined) return undefined;
  if (!categorySlug) return null;

  const category = await findCategoryBySlug(categorySlug);
  if (!category) throw new AppError('Category not found.', 400);
  return category.id;
}

export const listPlacesAdmin = asyncHandler(async (req, res) => {
  const items = await listAdminPlaces({
    q: req.query.q,
    status: req.query.status || 'ALL',
    limit: req.query.limit,
    offset: req.query.offset
  });
  res.json({ items });
});

export const getPlaceAdmin = asyncHandler(async (req, res) => {
  const placeId = Number(req.params.id);
  const [place, images] = await Promise.all([
    getPlaceById(placeId),
    getAdminPlaceImages(placeId)
  ]);
  if (!place) throw new AppError('Place not found.', 404);
  res.json({ ...place, imageItems: images });
});

export const createPlaceAdmin = asyncHandler(async (req, res) => {
  const categoryId = await resolveCategoryId(req.body.categorySlug);

  const placeId = await createPlace({
    name: req.body.name,
    description: req.body.description,
    categoryId,
    address: req.body.address,
    lat: req.body.lat,
    lng: req.body.lng,
    phone: req.body.phone,
    website: req.body.website,
    priceLevel: req.body.priceLevel,
    openingHours: req.body.openingHours,
    googlePlaceId: req.body.googlePlaceId,
    googleMapsUri: req.body.googleMapsUri,
    status: req.body.status || 'PUBLISHED',
    source: 'ADMIN',
    createdBy: req.user.id
  });

  const place = await getPlaceById(placeId);
  res.status(201).json(place);
});

export const updatePlaceAdmin = asyncHandler(async (req, res) => {
  const placeId = Number(req.params.id);
  const existing = await getPlaceById(placeId);
  if (!existing) throw new AppError('Place not found.', 404);

  const categoryId = await resolveCategoryId(req.body.categorySlug);
  const fields = mapAdminFields(req.body, categoryId);
  await updatePlaceFields(placeId, fields);

  if (req.body.lat !== undefined && req.body.lng !== undefined) {
    await updatePlaceLocation(placeId, Number(req.body.lat), Number(req.body.lng));
  }

  const place = await getPlaceById(placeId);
  res.json(place);
});

export const archivePlaceAdmin = asyncHandler(async (req, res) => {
  const placeId = Number(req.params.id);
  const existing = await getPlaceById(placeId);
  if (!existing) throw new AppError('Place not found.', 404);

  await updatePlaceFields(placeId, { status: 'ARCHIVED' });
  res.json({ ok: true, id: placeId, status: 'ARCHIVED' });
});

export const uploadPlaceImagesAdmin = asyncHandler(async (req, res) => {
  const placeId = Number(req.params.id);
  const place = await getPlaceById(placeId);
  if (!place) throw new AppError('Place not found.', 404);

  const assets = await storeUploadedFiles(req.files || [], {
    scope: 'places',
    prefix: 'place-' + placeId + '-admin'
  });

  try {
    await addPlaceImageAssets(placeId, assets, req.user.id);
    const images = await getAdminPlaceImages(placeId);
    res.status(201).json({ items: images });
  } catch (error) {
    await deleteStoredAssets(assets);
    throw error;
  }
});

export const makeCoverAdmin = asyncHandler(async (req, res) => {
  const placeId = Number(req.params.id);
  const imageId = Number(req.params.imageId);
  await setPlaceImageCover(placeId, imageId);
  const images = await getAdminPlaceImages(placeId);
  res.json({ items: images });
});

export const deletePlaceImageAdmin = asyncHandler(async (req, res) => {
  const placeId = Number(req.params.id);
  const imageId = Number(req.params.imageId);
  const asset = await removePlaceImage(placeId, imageId);

  if (asset.provider && asset.publicId) {
    await deleteStoredAssets([asset]);
  }

  const images = await getAdminPlaceImages(placeId);
  res.json({ items: images });
});
