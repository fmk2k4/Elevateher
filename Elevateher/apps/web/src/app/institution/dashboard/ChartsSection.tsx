"use client";
/* istanbul ignore file */
// ChartsSection is lazy-loaded to split recharts (~400KB) into its own chunk.
// The parent InstitutionDashboard page fetches data and passes it here;
// this component only handles rendering, so it's isolated from the main bundle.
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const PIE_COLORS = ["#7C3AED", "#EC4899", "#10B981", "#F59E0B", "#3B82F6"];

const S = {
  card: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 24,
  },
};

// Skeleton shown while recharts chunk loads
function ChartsSkeleton({ height = 240 }) {
  return (
    <div
      style={{
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(255,255,255,0.03)",
        borderRadius: 8,
        color: "rgba(255,255,255,0.3)",
        fontSize: 14,
      }}
    >
      Loading charts…
    </div>
  );
}

export function SdgImpactChart({ sdgData }: { sdgData: any[] }) {
  if (!sdgData || sdgData.length === 0) {
    return <ChartsSkeleton height={240} />;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={sdgData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="name"
          tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "#1A0F2E",
            border: "1px solid rgba(124,58,237,0.3)",
            borderRadius: 10,
            color: "#fff",
          }}
        />
        <Bar dataKey="SDG 4.4" fill="#C41E3A" radius={[4, 4, 0, 0]} />
        <Bar dataKey="SDG 5.5" fill="#E5243B" radius={[4, 4, 0, 0]} />
        <Bar dataKey="SDG 8.6" fill="#A21942" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrackDistributionChart({
  trackData,
}: {
  trackData: Array<{ name: string; value: number }>;
}) {
  if (!trackData || trackData.length === 0) {
    return <ChartsSkeleton height={180} />;
  }
  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie
          data={trackData}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          dataKey="value"
          paddingAngle={3}
        >
          {trackData.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "#1A0F2E",
            border: "1px solid rgba(124,58,237,0.3)",
            borderRadius: 10,
            color: "#fff",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// Lazy-loaded wrapper — recharts lives in this child chunk
export default function ChartsSection({
  sdgData,
  trackData,
}: {
  sdgData: any[];
  trackData: Array<{ name: string; value: number }>;
}) {
  return (
    <>
      {/* SDG Impact — left column */}
      <div style={S.card}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>
          📊 SDG Impact Events by Partner Institution
        </h3>
        <SdgImpactChart sdgData={sdgData} />
      </div>

      {/* Track Distribution — right column */}
      <div style={S.card}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>
          🎯 Career Track Distribution
        </h3>
        <TrackDistributionChart trackData={trackData} />
        {/* Track legend */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 10,
          }}
        >
          {trackData.map((t, i) => (
            <div
              key={t.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: PIE_COLORS[i % PIE_COLORS.length],
                }}
              />
              <span style={{ color: "rgba(255,255,255,0.6)" }}>
                {t.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}