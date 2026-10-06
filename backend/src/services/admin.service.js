import { withTransaction } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import { findCategoryBySlug } from './category.service.js';
import {
  createPlace, updatePlaceFields, updatePlaceLocation, addPlaceImages, addPlaceImageAssets
} from './place.service.js';
import {
  getContributionForUpdate, markContributionReviewed, recordChange, getContributionById
} from './contribution.service.js';
import { awardPointsForApproval, penalizeRejection } from './points.service.js';
import { evaluateContributionScore } from './contributionScoring.service.js';
import { findUserById } from './user.service.js';
import { deleteStoredAssets } from './storage.service.js';
import { createNotification } from './notification.service.js';
import { applyMissionBonusesForContribution } from './mission.service.js';
import { refreshUserExpertise } from './expertise.service.js';
import {
  isRoadStatusContributionType,
  roadStatusDisplayName,
  roadStatusLayerType
} from './roadStatus.service.js';
import {
  assertCtvCanModerate,
  recordCtvReview
} from './contributionTrust.service.js';
import {
  capturePlaceSnapshot,
  recordPlaceRevision
} from './placeRevision.service.js';

function sourceForRole(role) {
  if (role === 'ADMIN' || role === 'MODERATOR') return 'ADMIN';
  if (role === 'CTV' || role === 'CONTRIBUTOR') return 'CTV';
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

    if (Array.isArray(payload.photoAssets) && payload.photoAssets.length) {
      await addPlaceImageAssets(placeId, payload.photoAssets, contribution.user_id, client);
    } else if (Array.isArray(payload.photos) && payload.photos.length) {
      await addPlaceImages(placeId, payload.photos, contribution.user_id, client);
    }

    return { placeId };
  }

  if (isRoadStatusContributionType(contribution.type)) {
    if (!payload.location) throw new AppError('Road status report has no location.', 400);

    const layerType = roadStatusLayerType(contribution.type);
    const properties = {
      description: payload.reason || '',
      source: 'COMMUNITY_VERIFIED',
      sourceType: 'COMMUNITY',
      sourceLabel: 'Cộng đồng · đã xác minh',
      verificationStatus: 'VERIFIED',
      contributionId: contribution.id,
      reportId: contribution.id,
      photos: Array.isArray(payload.photos) ? payload.photos : []
    };

    await client.query(
      `INSERT INTO map_features (
         layer_type, name, geometry, properties, severity, status,
         valid_from, valid_until, created_by, updated_by
       ) VALUES (
         $1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5::jsonb, $6, 'ACTIVE',
         NOW(), $7, $8, $9
       )`,
      [
        layerType,
        roadStatusDisplayName(contribution.type),
        Number(payload.location.lng),
        Number(payload.location.lat),
        JSON.stringify(properties),
        payload.severity || 'MEDIUM',
        payload.expiresAt || null,
        contribution.user_id,
        contribution.user_id
      ]
    );

    return { placeId: null };
  }

  if (!contribution.place_id) throw new AppError('This contribution has no associated place.', 400);
  const placeId = contribution.place_id;

  if (contribution.type === 'UPDATE_PLACE') {
    const fieldMap = {
      name: 'name', address: 'address', description: 'description', phone: 'phone',
      website: 'website', price: 'price_level', openingHours: 'opening_hours'
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

  if (contribution.type === 'ADD_PHOTO') {
    if (Array.isArray(payload.photoAssets) && payload.photoAssets.length) {
      await addPlaceImageAssets(placeId, payload.photoAssets, contribution.user_id, client);
    } else if (Array.isArray(payload.photos) && payload.photos.length) {
      await addPlaceImages(placeId, payload.photos, contribution.user_id, client);
    }
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

export async function approveContribution(contributionId, reviewer, review = {}) {
  return withTransaction(async (client) => {
    const contribution = await getContributionForUpdate(contributionId, client);
    if (!contribution) throw new AppError('Contribution not found.', 404);
    if (contribution.status !== 'PENDING') throw new AppError('Contribution has already been reviewed.', 409);

    assertCtvCanModerate(reviewer, contribution);

    const score = evaluateContributionScore(review.scoreBreakdown);
    const scoreNote = String(review.scoreNote || '').trim().slice(0, 1000) || null;
    const beforeSnapshot = contribution.place_id
      ? await capturePlaceSnapshot(contribution.place_id, client)
      : null;
    const { placeId } = await applyContributionToPlace(contribution, client);
    const afterSnapshot = placeId ? await capturePlaceSnapshot(placeId, client) : null;

    if (placeId && afterSnapshot) {
      await recordPlaceRevision({
        placeId,
        action: contribution.type === 'CREATE_PLACE' ? 'CREATE' : 'CONTRIBUTION_APPLY',
        beforeSnapshot,
        afterSnapshot,
        actorUserId: reviewer.id,
        contributionId,
        reason: 'Áp dụng đóng góp ' + contribution.type
      }, client);
    }

    const moderation = {
      pointsAwarded: score.total,
      maxPoints: score.maxPoints,
      scoreBreakdown: score.breakdown,
      scoreNote,
      scoredBy: reviewer.id,
      scoredAt: new Date().toISOString()
    };

    await markContributionReviewed(contributionId, {
      status: 'APPROVED',
      reviewedBy: reviewer.id,
      placeId,
      moderation
    }, client);
    await recordCtvReview(reviewer.id, client);

    const points = await awardPointsForApproval({
      userId: contribution.user_id,
      contributionId,
      type: contribution.type,
      amount: score.total
    }, client);

    const missionAwards = await applyMissionBonusesForContribution({
      contributionId,
      userId: contribution.user_id,
      type: contribution.type,
      client
    });
    const missionBonus = missionAwards.reduce(
      (total, item) => total + Number(item.perContributionBonus || 0) + Number(item.completionBonus || 0),
      0
    );

    const expertiseUpdate = await refreshUserExpertise(contribution.user_id, client);
    const unlockedBadges = Array.isArray(expertiseUpdate?.unlockedBadges)
      ? expertiseUpdate.unlockedBadges
      : [];

    let notificationMessage = `Đóng góp của bạn đã được duyệt: +${points}/${score.maxPoints} điểm chất lượng.`;
    if (missionBonus > 0) notificationMessage += ` Thưởng nhiệm vụ: +${missionBonus} điểm.`;
    if (unlockedBadges.length > 0) {
      notificationMessage += ` Mở huy hiệu: ${unlockedBadges.slice(0, 2).map((item) => item.title).join(', ')}.`;
    }

    await createNotification({
      userId: contribution.user_id,
      type: 'CONTRIBUTION_APPROVED',
      title: 'Đóng góp đã được duyệt',
      message: notificationMessage,
      data: {
        contributionId, placeId, points, maxPoints: score.maxPoints,
        scoreBreakdown: score.breakdown, scoreNote, missionBonus,
        missionAwards, contributionType: contribution.type,
        expertiseBadgesUnlocked: unlockedBadges
      }
    }, client);

    return getContributionById(contributionId, client);
  });
}

export async function rejectContribution(contributionId, reviewer, reason) {
  const reviewed = await withTransaction(async (client) => {
    const contribution = await getContributionForUpdate(contributionId, client);
    if (!contribution) throw new AppError('Contribution not found.', 404);
    if (contribution.status !== 'PENDING') throw new AppError('Contribution has already been reviewed.', 409);

    assertCtvCanModerate(reviewer, contribution);

    await markContributionReviewed(contributionId, {
      status: 'REJECTED',
      reviewedBy: reviewer.id,
      rejectReason: reason
    }, client);
    await recordCtvReview(reviewer.id, client);
    await penalizeRejection(contribution.user_id, client);
    await refreshUserExpertise(contribution.user_id, client);

    await createNotification({
      userId: contribution.user_id,
      type: 'CONTRIBUTION_REJECTED',
      title: 'Đóng góp chưa được duyệt',
      message: reason ? 'Lý do: ' + reason : 'Đóng góp của bạn chưa đáp ứng tiêu chí xuất bản.',
      data: {
        contributionId,
        placeId: contribution.place_id,
        contributionType: contribution.type
      }
    }, client);

    return getContributionById(contributionId, client);
  });

  const assets = reviewed?.payload?.photoAssets;
  if (Array.isArray(assets) && assets.length) await deleteStoredAssets(assets);
  return reviewed;
}
