import { z } from "zod";

const email = z
  .string()
  .trim()
  .email("Masukkan alamat email yang valid.")
  .max(160, "Email terlalu panjang.");

const username = z
  .string()
  .trim()
  .min(3, "Username minimal 3 karakter.")
  .max(32, "Username maksimal 32 karakter.")
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    "Username hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung.",
  );

const password = z
  .string()
  .min(8, "Password minimal 8 karakter.")
  .max(128, "Password terlalu panjang.")
  .regex(/[A-Za-z]/, "Password harus mengandung huruf.")
  .regex(/[0-9]/, "Password harus mengandung angka.");

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(100),
    username,
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Konfirmasi password tidak cocok.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  identity: z.string().trim().min(1, "Email atau username wajib diisi."),
  password: z.string().min(1, "Password wajib diisi."),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(100),
  username,
  email,
});

export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password saat ini wajib diisi."),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Konfirmasi password baru tidak cocok.",
    path: ["confirmPassword"],
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "Password baru harus berbeda dari password saat ini.",
    path: ["newPassword"],
  });

export type ActionState = {
  status?: "success" | "error";
  message?: string;
  errors?: Record<string, string[]>;
};
