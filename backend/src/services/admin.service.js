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
import { evaluateContributionScore, CONTRIBUTION_SCORE_CRITERIA } from './contributionScoring.service.js';
import { findUserById } from './user.service.js';
import { deleteStoredAssets } from './storage.service.js';
import { findNearbyPropertyCandidates, normalizePropertyPhone } from './realEstateDuplicates.service.js';
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

export async function assertRealEstateReviewer(contribution, reviewer, client) {
  let isProperty = Boolean(
    contribution.payload?.place?.realEstate ||
    contribution.payload?.place?.realEstatePriceVnd !== undefined ||
    (contribution.type === 'CREATE_PLACE' &&
     contribution.payload?.place?.categorySlug === 'bat-dong-san')
  );
  if (!isProperty && contribution.place_id) {
    const { rows } = await client.query(
      `SELECT c.slug FROM places p JOIN categories c ON c.id=p.category_id
        WHERE p.id=$1 LIMIT 1`,
      [contribution.place_id]
    );
    isProperty = rows[0]?.slug === 'bat-dong-san';
  }
  if (isProperty && !['ADMIN', 'MODERATOR'].includes(reviewer.role)) {
    throw new AppError('Tin bất động sản cần quản trị viên duyệt trực tiếp.', 403);
  }
  return isProperty;
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

    if (place.realEstate) {
      const lockKey = [
        normalizePropertyPhone(place.phone),
        String(place.name || '').trim().toLowerCase()
      ].join(':');
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [lockKey]);
      // Block exact same-title, same-contact listings within a small radius,
      // including concurrent approvals (the source contribution is locked).
      // Other nearby apartments/properties are valid and remain reviewable.
      const { rows: duplicateRows } = await client.query(
        `SELECT p.id
         FROM places p
         JOIN categories c ON c.id = p.category_id
         WHERE p.status = 'PUBLISHED'
           AND c.slug = 'bat-dong-san'
           AND lower(trim(p.name)) = lower(trim($1))
           AND (
             CASE
               WHEN regexp_replace(COALESCE(p.phone,''), '[^0-9]', '', 'g')
                    ~ '^84[0-9]{9,10}
           AND ST_DWithin(
             p.location::geography,
             ST_SetSRID(ST_MakePoint($3, $4),4326)::geography,
             25
           )
         LIMIT 1`,
        [place.name, normalizePropertyPhone(place.phone),
          Number(payload.location?.lng), Number(payload.location?.lat)]
      );
      if (duplicateRows.length) {
        throw new AppError(
          'Tin bất động sản trùng tên, số liên hệ và vị trí với địa điểm #' + duplicateRows[0].id +
          '. Hãy kiểm tra trước khi duyệt.',
          409
        );
      }
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
      priceLevel: place.realEstate
        ? new Intl.NumberFormat('vi-VN').format(
            place.realEstate.transactionType === 'SALE'
              ? Number(place.realEstate.totalPriceVnd)
              : Number(place.realEstate.monthlyRentVnd)
          ) + ' đ' + (place.realEstate.transactionType === 'RENT' ? '/tháng' : '')
        : place.price,
      openingHours: place.openingHours,
      status: 'PUBLISHED',
      source: sourceForRole(contributor?.role),
      createdBy: contribution.user_id
    }, client);

    if (place.realEstate) {
      const listing = place.realEstate;
      if (place.categorySlug !== 'bat-dong-san') {
        throw new AppError('Danh mục tin bất động sản không hợp lệ.', 400);
      }
      await client.query(
        `INSERT INTO housing_listings (
          place_id, listing_type, property_type, total_price_vnd,
          monthly_rent, area_m2, contact_name, availability_status, verification_source,
          listing_status, last_confirmed_at, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'UNKNOWN', 'COMMUNITY',
                  'ACTIVE', NOW(), NOW() + INTERVAL '30 days')`,
        [
          placeId,
          listing.transactionType,
          listing.propertyType,
          listing.transactionType === 'SALE' ? Number(listing.totalPriceVnd) : null,
          listing.transactionType === 'RENT' ? Number(listing.monthlyRentVnd) : null,
          Number(listing.areaM2),
          listing.contactName || null
        ]
      );
    }

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
  if (contribution.type === 'UPDATE_PRICE' && place.realEstatePriceVnd !== undefined) {
    const { rows } = await client.query(
      'SELECT listing_type, listing_status FROM housing_listings WHERE place_id = $1 FOR UPDATE',
      [placeId]
    );
    const listing = rows[0];
    if (!listing || listing.listing_status !== 'ACTIVE') {
      throw new AppError('Tin bất động sản không còn hoạt động hoặc không tồn tại.', 409);
    }
    const price = Number(place.realEstatePriceVnd);
    if (!Number.isSafeInteger(price) || price <= 0 ||
        (listing.listing_type === 'RENT' && price > 100000000)) {
      throw new AppError('Giá bất động sản không hợp lệ.', 400);
    }
    const priceLabel = new Intl.NumberFormat('vi-VN').format(price) + ' đ' +
      (listing.listing_type === 'RENT' ? '/tháng' : '');
    if (listing.listing_type === 'SALE') {
      await client.query(
        'UPDATE housing_listings SET total_price_vnd = $1, updated_at = NOW() WHERE place_id = $2',
        [price, placeId]
      );
    } else {
      await client.query(
        'UPDATE housing_listings SET monthly_rent = $1, updated_at = NOW() WHERE place_id = $2',
        [price, placeId]
      );
    }
    await updatePlaceFields(placeId, { price_level: priceLabel }, client);
    await recordChange(contribution.id, 'real_estate_price_vnd', null, String(price), client);
  } else if (contribution.type === 'UPDATE_PRICE' && place.price) {
    const { rows: categoryRows } = await client.query(
      `SELECT c.slug FROM places p JOIN categories c ON c.id=p.category_id
        WHERE p.id=$1 LIMIT 1`,
      [placeId]
    );
    if (categoryRows[0]?.slug === 'bat-dong-san') {
      throw new AppError(
        'Tin bất động sản cần cập nhật giá dạng số qua luồng chờ duyệt.',
        400
      );
    }
    await updatePlaceFields(placeId, { price_level: place.price }, client);
    await recordChange(contribution.id, 'price_level', null, place.price, client);
  }
  if (contribution.type === 'REPORT_CLOSED') {
    const closed = await client.query(
      `UPDATE housing_listings
          SET listing_status = 'PAUSED', updated_at = NOW()
        WHERE place_id = $1 AND listing_status = 'ACTIVE'
        RETURNING place_id`,
      [placeId]
    );
    await updatePlaceFields(placeId, { status: 'ARCHIVED' }, client);
    if (closed.rows.length) {
      await recordChange(contribution.id, 'listing_status', 'ACTIVE', 'PAUSED', client);
      const { rows: owners } = await client.query(
        'SELECT created_by, name FROM places WHERE id=$1 AND created_by IS NOT NULL',
        [placeId]
      );
      if (owners[0] && Number(owners[0].created_by) !== Number(contribution.user_id)) {
        await createNotification({
          userId: owners[0].created_by,
          type: 'HOUSING_LISTING_HIDDEN',
          title: 'Tin bất động sản đã được tạm ẩn',
          message: 'Tin "' + owners[0].name + '" đã được tạm ẩn sau khi HOLA kiểm tra báo cáo. Nếu thông tin chưa chính xác, hãy liên hệ quản trị viên.',
          data: { placeId: String(placeId), url: '/tin-bat-dong-san-cua-toi' }
        }, client);
      }
    }
  }

  return { placeId };
}

export async function approveContribution(contributionId, reviewer, review = {}) {
  return withTransaction(async (client) => {
    const contribution = await getContributionForUpdate(contributionId, client);
    if (!contribution) throw new AppError('Contribution not found.', 404);
    if (contribution.status !== 'PENDING') throw new AppError('Contribution has already been reviewed.', 409);

    assertCtvCanModerate(reviewer, contribution);
    const isPropertyContribution = await assertRealEstateReviewer(contribution, reviewer, client);
    const submittedListing = contribution.payload?.place?.realEstate;
    if (isPropertyContribution && contribution.type === 'CREATE_PLACE' && !submittedListing) {
      throw new AppError('Tin bất động sản kiểu cũ thiếu xác nhận liên hệ và thông tin tài sản. Yêu cầu gửi lại.', 409);
    }
    if (submittedListing) {
      // Re-check on the server at approval time; an earlier UI check may
      // have become stale while another reviewer approved a nearby listing.
      const duplicates = await findNearbyPropertyCandidates({
        contributionId,
        payload: contribution.payload,
        client
      });
      if (duplicates.items.length > 0 && review.nearbyListingsReviewed !== true) {
        throw new AppError(
          'Hãy kiểm tra các tin gần vị trí và xác nhận trước khi xuất bản.',
          409,
          {
            code: 'PROPERTY_NEARBY_REVIEW_REQUIRED',
            nearbyCount: duplicates.items.length,
            requiresReview: duplicates.requiresReview
          }
        );
      }
      if (submittedListing.publicContactConsent !== true) {
        throw new AppError('Tin chưa có xác nhận công khai thông tin liên hệ. Yêu cầu người đăng gửi lại.', 409);
      }
      if ((contribution.payload?.photos?.length || contribution.payload?.photoAssets?.length) &&
          submittedListing.imageRightsConfirmed !== true) {
        throw new AppError('Tin chưa xác nhận quyền sử dụng ảnh. Yêu cầu người đăng gửi lại.', 409);
      }
    }

    const isRealEstate = isPropertyContribution;
    // Property moderation is not a gamified contribution. Force a zero score
    // server-side; never trust an arbitrary reviewer-provided score.
    const score = evaluateContributionScore(
      isRealEstate
        ? Object.fromEntries(CONTRIBUTION_SCORE_CRITERIA.map((criterion) => [criterion.key, 0]))
        : review.scoreBreakdown
    );
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

    const missionAwards = isRealEstate
      ? []
      : await applyMissionBonusesForContribution({
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

    let notificationMessage = isRealEstate
      ? 'Tin bất động sản của bạn đã được duyệt và xuất hiện trên bản đồ.'
      : `Đóng góp của bạn đã được duyệt: +${points}/${score.maxPoints} điểm chất lượng.`;
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
    await assertRealEstateReviewer(contribution, reviewer, client);

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

               THEN '0' || substring(
                 regexp_replace(COALESCE(p.phone,''), '[^0-9]', '', 'g') FROM 3)
               ELSE regexp_replace(COALESCE(p.phone,''), '[^0-9]', '', 'g')
             END
           ) = $2
           AND ST_DWithin(
             p.location::geography,
             ST_SetSRID(ST_MakePoint($3, $4),4326)::geography,
             25
           )
         LIMIT 1`,
        [place.name, place.phone, Number(payload.location?.lng), Number(payload.location?.lat)]
      );
      if (duplicateRows.length) {
        throw new AppError(
          'Tin bất động sản trùng tên, số liên hệ và vị trí với địa điểm #' + duplicateRows[0].id +
          '. Hãy kiểm tra trước khi duyệt.',
          409
        );
      }
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
      priceLevel: place.realEstate
        ? new Intl.NumberFormat('vi-VN').format(
            place.realEstate.transactionType === 'SALE'
              ? Number(place.realEstate.totalPriceVnd)
              : Number(place.realEstate.monthlyRentVnd)
          ) + ' đ' + (place.realEstate.transactionType === 'RENT' ? '/tháng' : '')
        : place.price,
      openingHours: place.openingHours,
      status: 'PUBLISHED',
      source: sourceForRole(contributor?.role),
      createdBy: contribution.user_id
    }, client);

    if (place.realEstate) {
      const listing = place.realEstate;
      if (place.categorySlug !== 'bat-dong-san') {
        throw new AppError('Danh mục tin bất động sản không hợp lệ.', 400);
      }
      await client.query(
        `INSERT INTO housing_listings (
          place_id, listing_type, property_type, total_price_vnd,
          monthly_rent, area_m2, contact_name, availability_status, verification_source,
          listing_status, last_confirmed_at, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'UNKNOWN', 'COMMUNITY',
                  'ACTIVE', NOW(), NOW() + INTERVAL '30 days')`,
        [
          placeId,
          listing.transactionType,
          listing.propertyType,
          listing.transactionType === 'SALE' ? Number(listing.totalPriceVnd) : null,
          listing.transactionType === 'RENT' ? Number(listing.monthlyRentVnd) : null,
          Number(listing.areaM2),
          listing.contactName || null
        ]
      );
    }

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
  if (contribution.type === 'UPDATE_PRICE' && place.realEstatePriceVnd !== undefined) {
    const { rows } = await client.query(
      'SELECT listing_type, listing_status FROM housing_listings WHERE place_id = $1 FOR UPDATE',
      [placeId]
    );
    const listing = rows[0];
    if (!listing || listing.listing_status !== 'ACTIVE') {
      throw new AppError('Tin bất động sản không còn hoạt động hoặc không tồn tại.', 409);
    }
    const price = Number(place.realEstatePriceVnd);
    if (!Number.isSafeInteger(price) || price <= 0 ||
        (listing.listing_type === 'RENT' && price > 100000000)) {
      throw new AppError('Giá bất động sản không hợp lệ.', 400);
    }
    const priceLabel = new Intl.NumberFormat('vi-VN').format(price) + ' đ' +
      (listing.listing_type === 'RENT' ? '/tháng' : '');
    if (listing.listing_type === 'SALE') {
      await client.query(
        'UPDATE housing_listings SET total_price_vnd = $1, updated_at = NOW() WHERE place_id = $2',
        [price, placeId]
      );
    } else {
      await client.query(
        'UPDATE housing_listings SET monthly_rent = $1, updated_at = NOW() WHERE place_id = $2',
        [price, placeId]
      );
    }
    await updatePlaceFields(placeId, { price_level: priceLabel }, client);
    await recordChange(contribution.id, 'real_estate_price_vnd', null, String(price), client);
  } else if (contribution.type === 'UPDATE_PRICE' && place.price) {
    const { rows: categoryRows } = await client.query(
      `SELECT c.slug FROM places p JOIN categories c ON c.id=p.category_id
        WHERE p.id=$1 LIMIT 1`,
      [placeId]
    );
    if (categoryRows[0]?.slug === 'bat-dong-san') {
      throw new AppError(
        'Tin bất động sản cần cập nhật giá dạng số qua luồng chờ duyệt.',
        400
      );
    }
    await updatePlaceFields(placeId, { price_level: place.price }, client);
    await recordChange(contribution.id, 'price_level', null, place.price, client);
  }
  if (contribution.type === 'REPORT_CLOSED') {
    const closed = await client.query(
      `UPDATE housing_listings
          SET listing_status = 'PAUSED', updated_at = NOW()
        WHERE place_id = $1 AND listing_status = 'ACTIVE'
        RETURNING place_id`,
      [placeId]
    );
    await updatePlaceFields(placeId, { status: 'ARCHIVED' }, client);
    if (closed.rows.length) {
      await recordChange(contribution.id, 'listing_status', 'ACTIVE', 'PAUSED', client);
      const { rows: owners } = await client.query(
        'SELECT created_by, name FROM places WHERE id=$1 AND created_by IS NOT NULL',
        [placeId]
      );
      if (owners[0] && Number(owners[0].created_by) !== Number(contribution.user_id)) {
        await createNotification({
          userId: owners[0].created_by,
          type: 'HOUSING_LISTING_HIDDEN',
          title: 'Tin bất động sản đã được tạm ẩn',
          message: 'Tin "' + owners[0].name + '" đã được tạm ẩn sau khi HOLA kiểm tra báo cáo. Nếu thông tin chưa chính xác, hãy liên hệ quản trị viên.',
          data: { placeId: String(placeId), url: '/tin-bat-dong-san-cua-toi' }
        }, client);
      }
    }
  }

  return { placeId };
}

export async function approveContribution(contributionId, reviewer, review = {}) {
  return withTransaction(async (client) => {
    const contribution = await getContributionForUpdate(contributionId, client);
    if (!contribution) throw new AppError('Contribution not found.', 404);
    if (contribution.status !== 'PENDING') throw new AppError('Contribution has already been reviewed.', 409);

    assertCtvCanModerate(reviewer, contribution);
    const isPropertyContribution = await assertRealEstateReviewer(contribution, reviewer, client);
    const submittedListing = contribution.payload?.place?.realEstate;
    if (isPropertyContribution && contribution.type === 'CREATE_PLACE' && !submittedListing) {
      throw new AppError('Tin bất động sản kiểu cũ thiếu xác nhận liên hệ và thông tin tài sản. Yêu cầu gửi lại.', 409);
    }
    if (submittedListing) {
      // Re-check on the server at approval time; an earlier UI check may
      // have become stale while another reviewer approved a nearby listing.
      const duplicates = await findNearbyPropertyCandidates({
        contributionId,
        payload: contribution.payload,
        client
      });
      if (duplicates.items.length > 0 && review.nearbyListingsReviewed !== true) {
        throw new AppError(
          'Hãy kiểm tra các tin gần vị trí và xác nhận trước khi xuất bản.',
          409,
          {
            code: 'PROPERTY_NEARBY_REVIEW_REQUIRED',
            nearbyCount: duplicates.items.length,
            requiresReview: duplicates.requiresReview
          }
        );
      }
      if (submittedListing.publicContactConsent !== true) {
        throw new AppError('Tin chưa có xác nhận công khai thông tin liên hệ. Yêu cầu người đăng gửi lại.', 409);
      }
      if ((contribution.payload?.photos?.length || contribution.payload?.photoAssets?.length) &&
          submittedListing.imageRightsConfirmed !== true) {
        throw new AppError('Tin chưa xác nhận quyền sử dụng ảnh. Yêu cầu người đăng gửi lại.', 409);
      }
    }

    const isRealEstate = isPropertyContribution;
    // Property moderation is not a gamified contribution. Force a zero score
    // server-side; never trust an arbitrary reviewer-provided score.
    const score = evaluateContributionScore(
      isRealEstate
        ? Object.fromEntries(CONTRIBUTION_SCORE_CRITERIA.map((criterion) => [criterion.key, 0]))
        : review.scoreBreakdown
    );
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

    const missionAwards = isRealEstate
      ? []
      : await applyMissionBonusesForContribution({
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

    let notificationMessage = isRealEstate
      ? 'Tin bất động sản của bạn đã được duyệt và xuất hiện trên bản đồ.'
      : `Đóng góp của bạn đã được duyệt: +${points}/${score.maxPoints} điểm chất lượng.`;
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
    await assertRealEstateReviewer(contribution, reviewer, client);

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
