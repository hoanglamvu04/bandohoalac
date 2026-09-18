import { withTransaction } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import { findCategoryBySlug } from './category.service.js';
import {
  createPlace, updatePlaceFields, updatePlaceLocation, addPlaceImages
} from './place.service.js';
import {
  getContributionForUpdate, markContributionReviewed, recordChange, getContributionById
} from './contribution.service.js';
import { awardPointsForApproval, penalizeRejection } from './points.service.js';
import { findUserById } from './user.service.js';

function sourceForRole(role) {
  if (role === 'ADMIN' || role === 'MODERATOR') return 'ADMIN';
  if (role === 'CONTRIBUTOR') return 'CTV';
  return 'USER';
}

async function applyContributionToPlace(contribution, client) {
  const payload = contribution.payload || {};
  const place = payload.place || {};

  if (contribution.type === 'CREATE_PLACE') {
    const contributor = await findUserById(contribution.user_id, client);
    let categoryId = null;
    if (place.categorySlug) {
      const category = await findCategoryBySlug(place.categorySlug, client);
      categoryId = category?.id || null;
    }

    const placeId = await createPlace({
      name: place.name,
      description: place.description,
      categoryId,
      address: place.address,
      lat: payload.location?.lat,
      lng: payload.location?.lng,
      phone: place.phone,
      website: place.website,
      priceLevel: place.price,
      openingHours: place.openingHours,
      status: 'PUBLISHED',
      source: sourceForRole(contributor?.role),
      createdBy: contribution.user_id
    }, client);

    if (Array.isArray(payload.photos) && payload.photos.length) {
      await addPlaceImages(placeId, payload.photos, contribution.user_id, client);
    }

    return { placeId };
  }

  if (!contribution.place_id) {
    throw new AppError('This contribution has no associated place.', 400);
  }

  const placeId = contribution.place_id;

  if (contribution.type === 'UPDATE_PLACE') {
    const fieldMap = {
      name: 'name',
      address: 'address',
      description: 'description',
      phone: 'phone',
      website: 'website',
      price: 'price_level',
      openingHours: 'opening_hours'
    };
    const updates = {};
    for (const [payloadKey, column] of Object.entries(fieldMap)) {
      if (place[payloadKey] !== undefined && place[payloadKey] !== '') {
        updates[column] = place[payloadKey];
        await recordChange(contribution.id, column, null, place[payloadKey], client);
      }
    }
    if (place.categorySlug) {
      const category = await findCategoryBySlug(place.categorySlug, client);
      if (category) updates.category_id = category.id;
    }
    await updatePlaceFields(placeId, updates, client);
  }

  if (contribution.type === 'ADD_PHOTO' && Array.isArray(payload.photos) && payload.photos.length) {
    await addPlaceImages(placeId, payload.photos, contribution.user_id, client);
  }

  if (contribution.type === 'FIX_LOCATION' && payload.location) {
    await updatePlaceLocation(placeId, payload.location.lat, payload.location.lng, client);
    await recordChange(contribution.id, 'location', null, `${payload.location.lat},${payload.location.lng}`, client);
  }

  if (contribution.type === 'UPDATE_HOURS' && place.openingHours) {
    await updatePlaceFields(placeId, { opening_hours: place.openingHours }, client);
    await recordChange(contribution.id, 'opening_hours', null, place.openingHours, client);
  }

  if (contribution.type === 'UPDATE_PRICE' && place.price) {
    await updatePlaceFields(placeId, { price_level: place.price }, client);
    await recordChange(contribution.id, 'price_level', null, place.price, client);
  }

  if (contribution.type === 'REPORT_CLOSED') {
    await updatePlaceFields(placeId, { status: 'ARCHIVED' }, client);
  }

  return { placeId };
}

export async function approveContribution(contributionId, moderatorId) {
  return withTransaction(async (client) => {
    const contribution = await getContributionForUpdate(contributionId, client);
    if (!contribution) throw new AppError('Contribution not found.', 404);
    if (contribution.status !== 'PENDING') throw new AppError('Contribution has already been reviewed.', 409);

    const { placeId } = await applyContributionToPlace(contribution, client);

    await markContributionReviewed(contributionId, {
      status: 'APPROVED',
      reviewedBy: moderatorId,
      placeId
    }, client);

    await awardPointsForApproval({
      userId: contribution.user_id,
      contributionId,
      type: contribution.type
    }, client);

    return getContributionById(contributionId, client);
  });
}

export async function rejectContribution(contributionId, moderatorId, reason) {
  return withTransaction(async (client) => {
    const contribution = await getContributionForUpdate(contributionId, client);
    if (!contribution) throw new AppError('Contribution not found.', 404);
    if (contribution.status !== 'PENDING') throw new AppError('Contribution has already been reviewed.', 409);

    await markContributionReviewed(contributionId, {
      status: 'REJECTED',
      reviewedBy: moderatorId,
      rejectReason: reason
    }, client);

    await penalizeRejection(contribution.user_id, client);

    return getContributionById(contributionId, client);
  });
}
