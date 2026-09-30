import { asyncHandler } from '../utils/asyncHandler.js';
import {
  listMyRedemptions,
  listPublicVoucherCampaigns,
  redeemVoucherCampaign
} from '../services/reward.service.js';

export const listRewards = asyncHandler(async (req, res) => {
  const data = await listPublicVoucherCampaigns(req.user?.id || null);
  res.json(data);
});

export const listMyRewards = asyncHandler(async (req, res) => {
  const data = await listMyRedemptions(req.user.id);
  res.json(data);
});

export const redeemReward = asyncHandler(async (req, res) => {
  const item = await redeemVoucherCampaign({
    campaignId: Number(req.params.id),
    userId: req.user.id
  });
  res.status(201).json(item);
});
