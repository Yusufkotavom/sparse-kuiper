"use client";

export type NewV2CopyVariant = "short" | "long";

type NewV2UxMetrics = {
  sessionStartedAt: string;
  firstJobCreatedAt?: string;
  assetClickCount: number;
  publisherClickCount: number;
  completedJobCount: number;
  copyExposureShort: number;
  copyExposureLong: number;
  copyCompletionShort: number;
  copyCompletionLong: number;
};

const METRICS_KEY = "newv2_ux_metrics";
const COPY_VARIANT_KEY = "newv2_copy_variant";
const COPY_EXPOSURE_SEEN_KEY = "newv2_copy_exposure_seen";

function nowIso() {
  return new Date().toISOString();
}

function defaultMetrics(): NewV2UxMetrics {
  return {
    sessionStartedAt: nowIso(),
    assetClickCount: 0,
    publisherClickCount: 0,
    completedJobCount: 0,
    copyExposureShort: 0,
    copyExposureLong: 0,
    copyCompletionShort: 0,
    copyCompletionLong: 0,
  };
}

export function readNewV2Metrics(): NewV2UxMetrics {
  if (typeof window === "undefined") return defaultMetrics();
  try {
    const raw = window.localStorage.getItem(METRICS_KEY);
    if (!raw) {
      const initial = defaultMetrics();
      window.localStorage.setItem(METRICS_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as NewV2UxMetrics;
    return {
      sessionStartedAt: parsed.sessionStartedAt || nowIso(),
      firstJobCreatedAt: parsed.firstJobCreatedAt,
      assetClickCount: Number(parsed.assetClickCount || 0),
      publisherClickCount: Number(parsed.publisherClickCount || 0),
      completedJobCount: Number(parsed.completedJobCount || 0),
      copyExposureShort: Number(parsed.copyExposureShort || 0),
      copyExposureLong: Number(parsed.copyExposureLong || 0),
      copyCompletionShort: Number(parsed.copyCompletionShort || 0),
      copyCompletionLong: Number(parsed.copyCompletionLong || 0),
    };
  } catch {
    return defaultMetrics();
  }
}

function writeNewV2Metrics(next: NewV2UxMetrics) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(METRICS_KEY, JSON.stringify(next));
}

export function trackNewV2AssetAction() {
  const current = readNewV2Metrics();
  writeNewV2Metrics({
    ...current,
    assetClickCount: current.assetClickCount + 1,
  });
}

export function trackNewV2PublisherAction(opts?: { completedJob?: boolean; countClick?: boolean; variant?: NewV2CopyVariant }) {
  const current = readNewV2Metrics();
  const completedJob = Boolean(opts?.completedJob);
  const countClick = opts?.countClick ?? true;
  const variant = opts?.variant;
  writeNewV2Metrics({
    ...current,
    publisherClickCount: countClick ? current.publisherClickCount + 1 : current.publisherClickCount,
    completedJobCount: completedJob ? current.completedJobCount + 1 : current.completedJobCount,
    firstJobCreatedAt: completedJob && !current.firstJobCreatedAt ? nowIso() : current.firstJobCreatedAt,
    copyCompletionShort: completedJob && variant === "short" ? current.copyCompletionShort + 1 : current.copyCompletionShort,
    copyCompletionLong: completedJob && variant === "long" ? current.copyCompletionLong + 1 : current.copyCompletionLong,
  });
}

export function trackNewV2CopyExposure(variant: NewV2CopyVariant, surface: "assets" | "publisher") {
  if (typeof window === "undefined") return;
  const seenRaw = window.localStorage.getItem(COPY_EXPOSURE_SEEN_KEY);
  let seen: Record<string, boolean> = {};
  if (seenRaw) {
    try {
      const parsed = JSON.parse(seenRaw) as Record<string, boolean>;
      seen = parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      seen = {};
    }
  }
  const flagKey = `${surface}:${variant}`;
  if (seen[flagKey]) {
    return;
  }

  const current = readNewV2Metrics();
  writeNewV2Metrics({
    ...current,
    copyExposureShort: variant === "short" ? current.copyExposureShort + 1 : current.copyExposureShort,
    copyExposureLong: variant === "long" ? current.copyExposureLong + 1 : current.copyExposureLong,
  });

  window.localStorage.setItem(
    COPY_EXPOSURE_SEEN_KEY,
    JSON.stringify({
      ...seen,
      [flagKey]: true,
    })
  );
}

export function summarizeNewV2UxKpis() {
  const current = readNewV2Metrics();
  const sessionStartedAtMs = new Date(current.sessionStartedAt).getTime();
  const firstJobCreatedAtMs = current.firstJobCreatedAt ? new Date(current.firstJobCreatedAt).getTime() : null;

  const timeToFirstJobSeconds =
    firstJobCreatedAtMs && !Number.isNaN(firstJobCreatedAtMs)
      ? Math.max(0, Math.round((firstJobCreatedAtMs - sessionStartedAtMs) / 1000))
      : null;

  const totalClicks = current.assetClickCount + current.publisherClickCount;
  const completionRate = totalClicks > 0 ? Math.round((current.completedJobCount / totalClicks) * 100) : 0;
  const shortConversion = current.copyExposureShort > 0 ? Math.round((current.copyCompletionShort / current.copyExposureShort) * 100) : 0;
  const longConversion = current.copyExposureLong > 0 ? Math.round((current.copyCompletionLong / current.copyExposureLong) * 100) : 0;

  return {
    ...current,
    timeToFirstJobSeconds,
    totalClicks,
    completionRate,
    shortConversion,
    longConversion,
  };
}

export function getNewV2CopyVariant(): NewV2CopyVariant {
  if (typeof window === "undefined") return "short";
  const existing = window.localStorage.getItem(COPY_VARIANT_KEY);
  if (existing === "short" || existing === "long") {
    return existing;
  }
  const assigned: NewV2CopyVariant = Math.random() >= 0.5 ? "short" : "long";
  window.localStorage.setItem(COPY_VARIANT_KEY, assigned);
  return assigned;
}
