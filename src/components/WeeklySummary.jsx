export default function WeeklySummary({
  workoutsByDate,
  activities,
  weekDays,
  goals = { minutes: 300, workouts: 4 }, // ✅ objectifs par défaut : 5h + 4 séances
}) {
  const toISO = (d) => d.toISOString().slice(0, 10);

  // Map activités par id -> unit (km/m) + couleur + nom
  const activityMap = new Map((activities ?? []).map((a) => [a.id, a]));

  // 1) Aplatir toutes les séances de la semaine (sur weekDays)
  const allWorkouts = weekDays.flatMap((d) => {
    const key = toISO(d);
    return workoutsByDate[key] ?? [];
  });

  const totalWorkouts = allWorkouts.length;

  // 2) Totaux globaux
  const totalMinutes = allWorkouts.reduce((sum, w) => sum + (w.duration_min ?? 0), 0);

  // Distance globale : attention, mélange km/m. On peut afficher un total global, mais c’est moins “pur”.
  // Ici on affiche un total “km équivalent” en convertissant tout en mètres puis en km.
  const totalDistanceM = allWorkouts.reduce((sum, w) => sum + (w.distance_m ?? 0), 0);

  const formatDuration = (min) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h ${String(m).padStart(2, "0")}min`;
  };

  const formatDistanceGlobal = (m) => {
    if (!m) return "—";
    return `${(m / 1000).toFixed(1)} km`;
  };

  const formatDistanceForActivity = (activityId, distanceM) => {
    if (!distanceM) return "—";
    const act = activityMap.get(activityId);
    const unit = act?.distance_unit ?? "km";
    if (unit === "m") return `${Math.round(distanceM)} m`;
    return `${(distanceM / 1000).toFixed(1)} km`;
  };

  // 3) Agrégation par activité
  const byActivity = {};
  for (const w of allWorkouts) {
    const act = w.activity || activityMap.get(w.activity_id);
    if (!act) continue;

    const id = act.id ?? w.activity_id;
    if (!byActivity[id]) {
      byActivity[id] = {
        id,
        name: act.name ?? "Activité",
        color: act.color ?? "#999999",
        minutes: 0,
        distance: 0,
        workouts: 0,
      };
    }
    byActivity[id].minutes += w.duration_min ?? 0;
    byActivity[id].distance += w.distance_m ?? 0;
    byActivity[id].workouts += 1;
  }

  const activitiesStats = Object.values(byActivity).sort((a, b) => b.minutes - a.minutes);

  // 4) Totaux par jour
  const byDay = weekDays.map((d) => {
    const key = toISO(d);
    const workouts = workoutsByDate[key] ?? [];
    const minutes = workouts.reduce((sum, w) => sum + (w.duration_min ?? 0), 0);
    return { date: key, minutes };
  });

  const maxDayMinutes = Math.max(...byDay.map((d) => d.minutes), 1);
  const dayLetters = ["L", "M", "M", "J", "V", "S", "D"];

  // 5) Objectifs (progress)
  const goalMinutes = goals?.minutes ?? 300;
  const goalWorkouts = goals?.workouts ?? 4;

  const pctMinutes = goalMinutes ? Math.min(100, Math.round((totalMinutes / goalMinutes) * 100)) : 0;
  const pctWorkouts = goalWorkouts ? Math.min(100, Math.round((totalWorkouts / goalWorkouts) * 100)) : 0;

  // 6) Donut chart (répartition par minutes)
  const donut = (() => {
    const size = 110;
    const stroke = 12;
    const radius = (size - stroke) / 2;
    const C = 2 * Math.PI * radius;

    const hasData = totalMinutes > 0 && activitiesStats.length > 0;
    if (!hasData) {
      return { size, stroke, radius, C, segments: [], centerLabel: "—" };
    }

    let offset = 0;
    const segments = activitiesStats
      .filter((a) => a.minutes > 0)
      .map((a) => {
        const frac = a.minutes / totalMinutes;
        const dash = frac * C;
        const seg = {
          id: a.id,
          color: a.color,
          dasharray: `${dash} ${C - dash}`,
          dashoffset: -offset,
          title: `${a.name} — ${Math.round(frac * 100)}% (${formatDuration(a.minutes)})`,
        };
        offset += dash;
        return seg;
      });

    return {
      size,
      stroke,
      radius,
      C,
      segments,
      centerLabel: `${Math.round((totalMinutes / 60) * 10) / 10}h`,
    };
  })();

  return (
    <section className="mt-10 bg-white rounded-xl shadow p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Résumé de la semaine</h2>
        <span className="text-xs text-gray-500">Visuel & instantané</span>
      </div>

      {/* 🔹 Top cards : charge + objectifs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Charge */}
        <div className="bg-gray-100 rounded-xl p-4">
          <p className="text-sm text-gray-600">Temps total</p>
          <p className="text-3xl font-bold mt-1">{formatDuration(totalMinutes)}</p>
          <p className="text-sm text-gray-600 mt-3">Distance totale</p>
          <p className="text-xl font-semibold">{formatDistanceGlobal(totalDistanceM)}</p>
          <p className="text-xs text-gray-500 mt-2">
            (Distance globale en km équivalent)
          </p>
        </div>

        {/* Donut */}
        <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-4">
          <div className="relative">
            <svg width={donut.size} height={donut.size} viewBox={`0 0 ${donut.size} ${donut.size}`}>
              {/* fond */}
              <circle
                cx={donut.size / 2}
                cy={donut.size / 2}
                r={donut.radius}
                fill="none"
                stroke="#e5e7eb"
                strokeWidth={donut.stroke}
              />
              {/* segments */}
              {donut.segments.map((s) => (
                <circle
                  key={s.id}
                  cx={donut.size / 2}
                  cy={donut.size / 2}
                  r={donut.radius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={donut.stroke}
                  strokeDasharray={s.dasharray}
                  strokeDashoffset={s.dashoffset}
                  strokeLinecap="butt"
                  transform={`rotate(-90 ${donut.size / 2} ${donut.size / 2})`}
                >
                  <title>{s.title}</title>
                </circle>
              ))}
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-sm text-gray-500">Total</div>
              <div className="text-xl font-bold">{donut.centerLabel}</div>
            </div>
          </div>

          <div className="min-w-0">
            <p className="font-semibold">Répartition</p>
            <p className="text-sm text-gray-600">
              Passe la souris sur le donut pour voir les détails.
            </p>
            <div className="mt-3 space-y-2">
              {activitiesStats.slice(0, 3).map((a) => {
                const pct = totalMinutes ? Math.round((a.minutes / totalMinutes) * 100) : 0;
                return (
                  <div key={a.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: a.color }} />
                      <span className="truncate">{a.name}</span>
                    </div>
                    <span className="text-gray-600 whitespace-nowrap">{pct}%</span>
                  </div>
                );
              })}
              {activitiesStats.length === 0 ? (
                <p className="text-sm text-gray-500">Aucune séance</p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Objectifs */}
        <div className="bg-gray-100 rounded-xl p-4">
          <p className="text-sm text-gray-600">Objectifs semaine</p>

          <div className="mt-3">
            <div className="flex items-center justify-between text-sm">
              <span>Temps</span>
              <span className="text-gray-700">
                {formatDuration(totalMinutes)} / {formatDuration(goalMinutes)}
              </span>
            </div>
            <div className="mt-2 h-3 bg-gray-200 rounded overflow-hidden">
              <div className="h-3 bg-black rounded" style={{ width: `${pctMinutes}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-1">{pctMinutes}%</p>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-sm">
              <span>Séances</span>
              <span className="text-gray-700">
                {totalWorkouts} / {goalWorkouts}
              </span>
            </div>
            <div className="mt-2 h-3 bg-gray-200 rounded overflow-hidden">
              <div className="h-3 bg-black rounded" style={{ width: `${pctWorkouts}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-1">{pctWorkouts}%</p>
          </div>

          <p className="text-xs text-gray-500 mt-3">
            (On rendra ces objectifs personnalisables plus tard.)
          </p>
        </div>
      </div>

      {/* 🔹 Par activité : cartes + barres */}
      <div>
        <h3 className="font-semibold mb-3">Par activité</h3>

        <div className="space-y-4">
          {activitiesStats.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune séance cette semaine</p>
          ) : (
            activitiesStats.map((a) => {
              const pct = totalMinutes ? Math.round((a.minutes / totalMinutes) * 100) : 0;

              return (
                <div key={a.id} className="rounded-lg bg-gray-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="inline-block w-3 h-3 rounded"
                        style={{ backgroundColor: a.color }}
                        title={a.name}
                      />
                      <span className="font-medium truncate">{a.name}</span>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        • {a.workouts} séance{a.workouts > 1 ? "s" : ""}
                      </span>
                    </div>

                    <div className="text-xs text-gray-600 text-right whitespace-nowrap">
                      <div>
                        {formatDuration(a.minutes)} • {pct}%
                      </div>
                      <div>{formatDistanceForActivity(a.id, a.distance)}</div>
                    </div>
                  </div>

                  <div className="mt-2 h-3 bg-gray-200 rounded overflow-hidden">
                    <div
                      className="h-3 rounded"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: a.color,
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 🔹 Volume par jour */}
      <div>
        <h3 className="font-semibold mb-3">Volume par jour</h3>

        <div className="flex items-end gap-2 h-28">
          {byDay.map((d, i) => {
            const heightPct = (d.minutes / maxDayMinutes) * 100;
            const label = `${dayLetters[i]} — ${formatDuration(d.minutes)}`;

            return (
              <div key={d.date} className="flex-1 flex flex-col items-center">
                <div
                  title={label}
                  className={[
                    "w-full rounded-t transition",
                    d.minutes === 0 ? "bg-gray-200" : "bg-gray-500 hover:bg-gray-700",
                  ].join(" ")}
                  style={{ height: `${heightPct}%` }}
                />
                <span className="text-xs mt-2 text-gray-700">{dayLetters[i]}</span>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-gray-500 mt-2">
          Astuce : passe la souris sur une barre pour voir le total du jour.
        </p>
      </div>
    </section>
  );
}