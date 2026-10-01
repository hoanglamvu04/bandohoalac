import { z } from 'zod';

const nullableAssetId = z.union([
  z.coerce.number().int().positive(),
  z.null()
]).optional();

export const adminUpdateBrandSettingsSchema = z.object({
  headerLogoAssetId: nullableAssetId,
  compactLogoAssetId: nullableAssetId,
  footerLogoAssetId: nullableAssetId,
  faviconAssetId: nullableAssetId,
  headerLogoDesktopWidth: z.coerce.number().int().min(60).max(420).optional(),
  headerLogoMobileWidth: z.coerce.number().int().min(50).max(300).optional(),
  headerLogoCompactWidth: z.coerce.number().int().min(24).max(120).optional(),
  footerLogoDesktopWidth: z.coerce.number().int().min(60).max(420).optional(),
  footerLogoMobileWidth: z.coerce.number().int().min(50).max(300).optional()
}).strict();
