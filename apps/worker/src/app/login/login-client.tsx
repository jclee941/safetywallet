"use client";

import { useState, useEffect } from "react";
import { Button, Input } from "@safetywallet/ui";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/hooks/use-translation";
import type {
  ApiResponse,
  AuthResponseDto,
  MeResponseDto,
} from "@safetywallet/types";
import { HardHat } from "lucide-react";

const ERROR_CODES: Record<string, string> = {
  USER_NOT_FOUND: "auth.error.accountNotFound",
  NAME_MISMATCH: "auth.error.invalidCredentials",
  ATTENDANCE_NOT_VERIFIED: "auth.error.accountLocked",
  ACCOUNT_LOCKED: "auth.error.accountLocked",
  RATE_LIMIT_EXCEEDED: "auth.error.tooManyAttempts",
};

function parseErrorMessage(err: unknown, t: (key: string) => string): string {
  if (err instanceof Error) {
    try {
      const parsed = JSON.parse(err.message);
      const rawCode =
        parsed?.error?.code ??
        (typeof parsed?.error === "string" ? parsed.error : undefined);
      const code =
        rawCode === "accountLocked"
          ? "ACCOUNT_LOCKED"
          : rawCode === "tooManyAttempts"
            ? "RATE_LIMIT_EXCEEDED"
            : rawCode;
      if (code && ERROR_CODES[code]) {
        switch (ERROR_CODES[code]) {
          case "auth.error.accountNotFound":
            return t("auth.error.accountNotFound");
          case "auth.error.invalidCredentials":
            return t("auth.error.invalidCredentials");
          case "auth.error.accountLocked":
            return t("auth.error.accountLocked");
          case "auth.error.tooManyAttempts":
            return t("auth.error.tooManyAttempts");
          default:
            return t("auth.success.loginFailed");
        }
      }
      if (parsed?.error?.message) {
        return parsed.error.message;
      }
    } catch {
      return t("auth.success.loginFailed");
    }
  }
  return t("auth.success.loginFailed");
}

export default function LoginClient() {
  const t = useTranslation();
  const { login, setCurrentSite, isAuthenticated, _hasHydrated } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api";

  useEffect(() => {
    if (_hasHydrated && isAuthenticated && !loading) {
      window.location.replace("/home/");
    }
  }, [_hasHydrated, isAuthenticated, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const loginResponse = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          dob: dob.trim(),
        }),
      });
      if (!loginResponse.ok) {
        throw new Error(await loginResponse.text());
      }
      const response =
        (await loginResponse.json()) as ApiResponse<AuthResponseDto>;

      login(
        response.data.user,
        response.data.accessToken,
        response.data.refreshToken,
      );

      try {
        const meRes = await fetch(`${apiUrl}/auth/me`, {
          headers: { Authorization: `Bearer ${response.data.accessToken}` },
        });
        if (!meRes.ok) {
          throw new Error("failed to fetch me");
        }
        const meResponse = (await meRes.json()) as ApiResponse<MeResponseDto>;
        if (meResponse.data.siteId) {
          setCurrentSite(meResponse.data.siteId);
        }
      } catch {
        setCurrentSite(null);
      }

      window.location.replace("/home/");
    } catch (err) {
      setError(parseErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  const phoneClean = phone.trim().replace(/-/g, "");
  const dobClean = dob.trim().replace(/-/g, "");
  const isPhoneValid = /^\d{10,11}$/.test(phoneClean);
  const isDobValid = /^\d{6,8}$/.test(dobClean);
  const isFormValid = isPhoneValid && name.trim().length > 0 && isDobValid;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#d8f0ff] px-6 py-10 text-[#123c7c] overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-transparent to-[#bfe3fb]/70" />
        <div className="absolute bottom-0 left-0 w-full px-4 pb-6">
          <Skyline />
        </div>
      </div>

      <div className="relative w-full max-w-md space-y-8">
        <header className="flex items-start justify-between text-[#1d3f83]">
          <div className="leading-[1.05] tracking-tight">
            <p className="text-2xl font-semibold">MIRAE</p>
            <p className="text-2xl font-semibold">DOSI</p>
          </div>
          <div className="text-right text-2xl font-bold">(주) 미래도시건설</div>
        </header>

        <div className="flex items-center justify-center gap-3">
          <h1 className="text-4xl font-serif font-semibold tracking-tight">
            Safe wallet
          </h1>
          <div className="relative">
            <HardHat
              className="h-12 w-12 text-[#f6c344]"
              strokeWidth={2.2}
              fill="currentColor"
            />
            <span className="absolute bottom-[2px] right-[6px] text-[10px] font-semibold tracking-tight text-[#1d3f83]">
              MDI
            </span>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="relative z-10 space-y-3 rounded-2xl bg-white/30 p-4 shadow-sm backdrop-blur-sm"
        >
          <div className="space-y-2">
            <label htmlFor="name" className="sr-only">
              {t("auth.name")}
            </label>
            <Input
              id="name"
              type="text"
              className="h-12 rounded-full border-2 border-[#1d3f83] bg-white/90 text-center text-lg font-semibold text-[#6c6c6c] placeholder:text-[#9aa3b5] shadow"
              placeholder={t("auth.name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              autoComplete="name"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="dob" className="sr-only">
              {t("auth.dateOfBirth")}
            </label>
            <Input
              id="dob"
              type="text"
              inputMode="numeric"
              className="h-12 rounded-full border-2 border-[#1d3f83] bg-white/90 text-center text-lg font-semibold text-[#6c6c6c] placeholder:text-[#9aa3b5] shadow"
              placeholder={t("auth.dateOfBirth")}
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              disabled={loading}
              autoComplete="bday"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="phone" className="sr-only">
              {t("auth.phoneNumber")}
            </label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              className="h-12 rounded-full border-2 border-[#1d3f83] bg-white/90 text-center text-lg font-semibold text-[#6c6c6c] placeholder:text-[#9aa3b5] shadow"
              placeholder={t("auth.phoneNumber")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
              autoComplete="tel"
            />
          </div>

          {error && (
            <p className="text-center text-sm font-medium text-[#c73737]">
              {error}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            className="h-12 w-full rounded-full bg-[#1f4b9b] text-lg font-bold tracking-tight hover:bg-[#1b3f85] disabled:cursor-not-allowed disabled:opacity-60 shadow"
            disabled={loading || !isFormValid}
          >
            {loading ? t("auth.success.loggingIn") : t("auth.login")}
          </Button>

          <p className="text-center text-xs font-medium text-[#4d689a]">
            {t("auth.loginFieldLoginOnly")}
            <br />
            {t("auth.loginFieldGuide")}
          </p>
        </form>
      </div>
    </div>
  );
}

function Skyline() {
  return (
    <svg
      viewBox="0 0 400 90"
      preserveAspectRatio="none"
      className="h-24 w-full text-white opacity-85"
      aria-hidden="true"
    >
      <rect x="0" y="50" width="28" height="40" fill="currentColor" />
      <rect x="34" y="35" width="26" height="55" fill="currentColor" />
      <rect x="66" y="20" width="30" height="70" fill="currentColor" />
      <rect x="102" y="10" width="34" height="80" fill="currentColor" />
      <rect x="142" y="30" width="24" height="60" fill="currentColor" />
      <rect x="172" y="45" width="26" height="45" fill="currentColor" />
      <rect x="204" y="18" width="30" height="72" fill="currentColor" />
      <rect x="242" y="32" width="26" height="58" fill="currentColor" />
      <rect x="274" y="24" width="28" height="66" fill="currentColor" />
      <rect x="308" y="14" width="32" height="76" fill="currentColor" />
      <rect x="346" y="36" width="28" height="54" fill="currentColor" />
      <rect x="380" y="48" width="20" height="42" fill="currentColor" />
    </svg>
  );
}
