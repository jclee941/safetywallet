import { z } from "zod";
import { nonEmptyStr } from "./shared.js";

// ─── Auth Schemas ────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  name: nonEmptyStr,
  phone: z
    .string()
    .transform((val) => val.replace(/[^0-9]/g, ""))
    .refine((val) => val.length === 11, "Phone number must be 11 digits"),
  dob: z
    .string()
    .transform((val) => val.replace(/[^0-9]/g, ""))
    .refine(
      (val) => val.length === 6 || val.length === 8,
      "DOB must be 6 or 8 digits",
    ),
  deviceId: z.string().optional(),
  turnstileToken: z.string().optional(),
});

export const LoginSchema = z.object({
  name: nonEmptyStr,
  phone: z.string().min(1),
  dob: z.string().min(1),
  turnstileToken: z.string().optional(),
});

export const AcetimeLoginSchema = z.object({
  employeeCode: z
    .string()
    .min(1, "Employee code is required")
    .max(50, "Employee code too long")
    .transform((val) => val.trim()),
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name too long")
    .transform((val) => val.trim()),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const AdminLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// admin-create-otp reuses OtpRequestDto shape
export const OtpRequestSchema = z.object({
  phone: z.string().min(1),
});
