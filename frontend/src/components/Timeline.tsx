"use client";

interface TimelineEvent {
  time: string;
  event: string;
  severity: "info" | "warning" | "critical";
}

interface Props {
  events: TimelineEvent[];
}

export default function Timeline({ events }: Props) {
  if (!events || events.length === 0) {
    return <p className="text-gray-500 text-sm">No timeline events</p>;
  }

  const severityStyles = {
    info: {
      dot: "bg-blue-400",
      line: "border-blue-400/30",
      text: "text-blue-400",
    },
    warning: {
      dot: "bg-yellow-400",
      line: "border-yellow-400/30",
      text: "text-yellow-400",
    },
    critical: {
      dot: "bg-red-400",
      line: "border-red-400/30",
      text: "text-red-400",
    },
  };

  return (
    <div className="space-y-0 max-h-[500px] overflow-y-auto pr-2">
      {events.map((event, i) => {
        const style = severityStyles[event.severity] || severityStyles.info;
        return (
          <div key={i} className="flex gap-3">
            {/* Vertical line and dot */}
            <div className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full ${style.dot} mt-1.5 shrink-0`} />
              {i < events.length - 1 && (
                <div className="w-px flex-1 bg-gray-700 my-1" />
              )}
            </div>
            {/* Content */}
            <div className="pb-4 min-w-0">
              <p className={`text-xs font-mono ${style.text} mb-0.5`}>
                {event.time}
              </p>
              <p className="text-sm text-gray-300">{event.event}</p>
              <span
                className={`inline-block text-xs mt-1 px-2 py-0.5 rounded-full ${
                  event.severity === "critical"
                    ? "bg-red-500/20 text-red-400"
                    : event.severity === "warning"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-blue-500/20 text-blue-400"
                }`}
              >
                {event.severity}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
