// src/lib/workoutMetrics.js

export function cx(...a) {
  return a.filter(Boolean).join(" ");
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function minutesToNice(min) {
  if (min == null) return "";
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h <= 0) return `${r} min`;
  if (r === 0) return `${h} h`;
  return `${h} h ${pad2(r)}`;
}

export function metersToNice(meters, unit = "km") {
  if (meters == null) return "";
  if (unit === "m") return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return `${km.toFixed(km >= 10 ? 0 : 1)} km`;
}

// vitesse en km/h (vélo) ou allure min/km (course)
export function computeSpeed({
  sport, // "run" | "bike" | "swim"
  durationMin,
  distanceM,
}) {
  if (!durationMin || !distanceM) return null;

  const hours = durationMin / 60;
  const km = distanceM / 1000;

  if (sport === "bike") {
    if (hours <= 0) return null;
    const kmh = km / hours;
    return { type: "kmh", value: kmh };
  }

  if (sport === "run") {
    if (km <= 0) return null;
    const paceMinPerKm = durationMin / km;
    return { type: "pace", value: paceMinPerKm };
  }

  if (sport === "swim") {
    // allure /100m
    const blocks100 = distanceM / 100;
    if (blocks100 <= 0) return null;
    const paceMinPer100 = durationMin / blocks100;
    return { type: "pace100", value: paceMinPer100 };
  }

  return null;
}

export function formatSpeed(speed) {
  if (!speed) return "";
  if (speed.type === "kmh") return `${speed.value.toFixed(speed.value >= 10 ? 0 : 1)} km/h`;

  if (speed.type === "pace") {
    const totalSec = Math.round(speed.value * 60);
    const mm = Math.floor(totalSec / 60);
    const ss = totalSec % 60;
    return `${mm}:${pad2(ss)} /km`;
  }

  if (speed.type === "pace100") {
    const totalSec = Math.round(speed.value * 60);
    const mm = Math.floor(totalSec / 60);
    const ss = totalSec % 60;
    return `${mm}:${pad2(ss)} /100m`;
  }

  return "";
}

// Subtitle premium: "45 min • 10 km • 5:00/km" / "60 min • 25 km • 25 km/h" / "30 min • 1500 m • 2:00/100m"
export function buildWorkoutSubtitle({
  sport = "run",
  durationMin = null,
  distanceM = null,
  distanceUnit = "km", // "km" | "m"
  showSpeed = true,
}) {
  const parts = [];

  if (durationMin != null) parts.push(minutesToNice(durationMin));
  if (distanceM != null) parts.push(metersToNice(distanceM, distanceUnit));

  if (showSpeed) {
    const speed = computeSpeed({ sport, durationMin, distanceM });
    const s = formatSpeed(speed);
    if (s) parts.push(s);
  }

  return parts.filter(Boolean).join(" • ");
}