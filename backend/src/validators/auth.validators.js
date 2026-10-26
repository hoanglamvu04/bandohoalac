import { z } from 'zod';

function passwordStrength(value) {
  const classes = [
    /[a-z]/.test(value),
    /[A-Z]/.test(value),
    /\d/.test(value),
    /[^A-Za-z0-9]/.test(value)
  ].filter(Boolean).length;

  return classes >= 3;
}

const strongPassword = z.string()
  .min(10, 'Mật khẩu phải có ít nhất 10 ký tự.')
  .max(128)
  .refine(passwordStrength, {
    message: 'Mật khẩu cần kết hợp ít nhất 3 nhóm: chữ thường, chữ hoa, số hoặc ký tự đặc biệt.'
  });

const optionalTotpCode = z.preprocess(
  (value) => value === '' || value === null ? undefined : value,
  z.string().trim().regex(/^\d{6}$/).optional()
);

const optionalRecoveryCode = z.preprocess(
  (value) => value === '' || value === null ? undefined : value,
  z.string().trim().min(12).max(32).optional()
);

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: strongPassword
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
  totpCode: optionalTotpCode,
  recoveryCode: optionalRecoveryCode
});

export const twoFactorSetupSchema = z.object({
  password: z.string().min(1).max(128)
});

export const twoFactorConfirmSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Mã xác thực phải gồm 6 chữ số.')
});

export const twoFactorDisableSchema = z.object({
  password: z.string().min(1).max(128),
  code: optionalTotpCode,
  recoveryCode: optionalRecoveryCode
}).refine(
  (value) => Boolean(value.code || value.recoveryCode),
  {
    message: 'Cần mã Authenticator hoặc mã khôi phục.',
    path: ['code']
  }
);

export const twoFactorRecoveryRegenerateSchema = z.object({
  password: z.string().min(1).max(128),
  code: z.string().trim().regex(/^\d{6}$/, 'Mã xác thực phải gồm 6 chữ số.')
});


export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: strongPassword
}).refine(
  (value) => value.currentPassword !== value.newPassword,
  {
    message: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
    path: ['newPassword']
  }
);
