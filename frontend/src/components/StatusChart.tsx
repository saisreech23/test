"use client";

interface Props {
  data: Record<string, number>;
}

export default function StatusChart({ data }: Props) {
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;

  const categories = [
    { key: "2xx", label: "2xx Success", color: "bg-green-500", textColor: "text-green-400" },
    { key: "3xx", label: "3xx Redirect", color: "bg-blue-500", textColor: "text-blue-400" },
    { key: "4xx", label: "4xx Client Error", color: "bg-yellow-500", textColor: "text-yellow-400" },
    { key: "5xx", label: "5xx Server Error", color: "bg-red-500", textColor: "text-red-400" },
  ];

  return (
    <div>
      {/* Stacked bar */}
      <div className="flex h-8 rounded-lg overflow-hidden mb-4">
        {categories.map((cat) => {
          const value = data[cat.key] || 0;
          const pct = (value / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={cat.key}
              className={`${cat.color} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${cat.label}: ${value} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2">
        {categories.map((cat) => {
          const value = data[cat.key] || 0;
          const pct = ((value / total) * 100).toFixed(1);
          return (
            <div key={cat.key} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-sm ${cat.color}`} />
              <span className="text-sm text-gray-400">
                {cat.label}:{" "}
                <span className={`font-medium ${cat.textColor}`}>
                  {value.toLocaleString()}
                </span>
                <span className="text-gray-500"> ({pct}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
