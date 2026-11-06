import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import {
  addPlaceToCollection,
  createCollection,
  deleteCollection,
  getMyCollection,
  getPublicCollection,
  listMyCollections,
  removePlaceFromCollection,
  replaceCollectionPlaces,
  updateCollection
} from '../services/collections.service.js';

export const listMine = asyncHandler(async (req, res) => {
  const items = await listMyCollections(req.user.id);
  res.set('Cache-Control', 'private, no-store');
  res.json({ items });
});

export const getMine = asyncHandler(async (req, res) => {
  const collection = await getMyCollection(Number(req.params.id), req.user.id);
  res.set('Cache-Control', 'private, no-store');
  res.json(collection);
});

export const getPublic = asyncHandler(async (req, res) => {
  const collection = await getPublicCollection(req.params.slug);
  if (!collection) throw new AppError('Bộ sưu tập không tồn tại hoặc chưa được công khai.', 404);
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  res.json(collection);
});

export const create = asyncHandler(async (req, res) => {
  const collection = await createCollection({
    userId: req.user.id,
    title: req.body.title,
    description: req.body.description,
    visibility: req.body.visibility
  });
  res.status(201).json(collection);
});

export const update = asyncHandler(async (req, res) => {
  const collection = await updateCollection(
    Number(req.params.id),
    req.user.id,
    req.body
  );
  res.json(collection);
});

export const remove = asyncHandler(async (req, res) => {
  await deleteCollection(Number(req.params.id), req.user.id);
  res.status(204).end();
});

export const addPlace = asyncHandler(async (req, res) => {
  await addPlaceToCollection(
    Number(req.params.id),
    req.user.id,
    Number(req.body.placeId)
  );
  const collection = await getMyCollection(Number(req.params.id), req.user.id);
  res.json(collection);
});

export const removePlace = asyncHandler(async (req, res) => {
  await removePlaceFromCollection(
    Number(req.params.id),
    req.user.id,
    Number(req.params.placeId)
  );
  const collection = await getMyCollection(Number(req.params.id), req.user.id);
  res.json(collection);
});

export const replacePlaces = asyncHandler(async (req, res) => {
  const collection = await replaceCollectionPlaces(
    Number(req.params.id),
    req.user.id,
    req.body.placeIds
  );
  res.json(collection);
});
