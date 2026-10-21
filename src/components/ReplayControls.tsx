"use client";

import {
  Play,
  Pause,
  StepForward,
  StepBack,
  SkipForward,
  Gauge,
} from "lucide-react";
import { useReplayStore } from "@/lib/store/useReplayStore";
import type { Timeframe } from "@/lib/domain/types";

const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1D"];
const SPEEDS = [0.1, 0.25, 0.5, 1, 2, 5, 10];

/** Compact UTC clock: "21 Oct 00:24". */
function formatClock(timeSec: number): string {
  const d = new Date(timeSec * 1000);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  });
}

/** Transport bar: play/pause, step, speed, timeframe and a scrubber. */
export function ReplayControls() {
  const status = useReplayStore((s) => s.status);
  const speed = useReplayStore((s) => s.speed);
  const timeframe = useReplayStore((s) => s.timeframe);
  const tick = useReplayStore((s) => s.tick);

  const play = useReplayStore((s) => s.play);
  const pause = useReplayStore((s) => s.pause);
  const stepForward = useReplayStore((s) => s.stepForward);
  const stepBackward = useReplayStore((s) => s.stepBackward);
  const setSpeed = useReplayStore((s) => s.setSpeed);
  const setTimeframe = useReplayStore((s) => s.setTimeframe);
  const jumpToTime = useReplayStore((s) => s.jumpToTime);

  // tick dependency keeps progress/time readouts live.
  void tick;
  const progress = useReplayStore.getState().progress();
  const currentTime = useReplayStore.getState().currentTime();
  const series = useReplayStore.getState().baseSeries;

  const isPlaying = status === "playing";

  const onScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = Number(e.target.value) / 1000;
    const first = series[0]?.time ?? 0;
    const last = series[series.length - 1]?.time ?? 0;
    jumpToTime(first + Math.round((last - first) * pct));
  };

  return (
    <div className="flex flex-col gap-2 border-t border-border bg-panel px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn" onClick={() => stepBackward(1)} title="Step back 1 bar">
          <StepBack size={16} />
        </button>
        <button
          className="btn btn-accent"
          onClick={() => (isPlaying ? pause() : play())}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button className="btn" onClick={() => stepForward(1)} title="Step forward 1 bar">
          <StepForward size={16} />
        </button>
        <button className="btn" onClick={() => stepForward(10)} title="Skip 10 bars">
          <SkipForward size={16} />
        </button>

        <div className="mx-2 flex items-center gap-1 text-slate-400">
          <Gauge size={14} />
          <select
            className="select"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              className={`tf ${timeframe === tf ? "tf-active" : ""}`}
              onClick={() => setTimeframe(tf)}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="ml-auto text-xs tabular-nums text-slate-400">
          {currentTime ? formatClock(currentTime) : "—"}
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={1000}
        value={Math.round(progress * 1000)}
        onChange={onScrub}
        className="w-full accent-accent"
      />
    </div>
  );
}
