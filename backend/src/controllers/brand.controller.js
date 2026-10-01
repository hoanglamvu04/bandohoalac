import { asyncHandler } from '../utils/asyncHandler.js';
import { getBrandSettings } from '../services/brand.service.js';

function publicSettings(settings) {
  return {
    headerLogoUrl: settings.headerLogoUrl,
    compactLogoUrl: settings.compactLogoUrl,
    footerLogoUrl: settings.footerLogoUrl,
    faviconUrl: settings.faviconUrl,
    headerLogoDesktopWidth: settings.headerLogoDesktopWidth,
    headerLogoMobileWidth: settings.headerLogoMobileWidth,
    headerLogoCompactWidth: settings.headerLogoCompactWidth,
    footerLogoDesktopWidth: settings.footerLogoDesktopWidth,
    footerLogoMobileWidth: settings.footerLogoMobileWidth,
    updatedAt: settings.updatedAt
  };
}

export const getBrandSettingsPublic = asyncHandler(async (_req, res) => {
  const settings = await getBrandSettings();
  res.json(publicSettings(settings));
});
