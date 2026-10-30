import { memo, useCallback, useMemo, useState, type PointerEvent } from "react";
import { cn } from "../../lib/cn";
import { formatScale, formatSpeed, peakOf, scaleMax, speedUnit, type Direction, type Sample, type Samples } from "./model";
import { SERIES } from "./series";

interface SpeedChartProps {
    samples: Samples;
    /** The test running now; its line ends in a dot. */
    live: Direction | null;
}

const DIRECTIONS: readonly Direction[] = ["download", "upload"];

const HEIGHT = 160;
const PAD = { top: 10, right: 12, bottom: 22, left: 40 };
/** Each test runs 15 s (public/openspeedtest/index.html). The axis stops there and later readings are left out, so both lines end together. */
const SECONDS = 15;

/** Seconds since the first reading of the same test, so both tests start at 0 and line up. */
const secondsOf = (samples: readonly Sample[], sample: Sample) => (sample.at - samples[0].at) / 1000;

/** The reading closest to `t` seconds into its test. */
function sampleAt(samples: readonly Sample[], t: number): Sample | null {
    let best: Sample | null = null;
    let bestDistance = Infinity;
    for (const sample of samples) {
        const distance = Math.abs(secondsOf(samples, sample) - t);
        if (distance < bestDistance) {
            best = sample;
            bestDistance = distance;
        }
    }
    return best;
}

/** Tracks an element's width. React 19 runs the returned cleanup when the element goes away. */
function useWidth() {
    const [width, setWidth] = useState(0);
    const ref = useCallback((element: HTMLElement | null) => {
        if (!element) return;
        const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    return [ref, width] as const;
}

/** Download and upload speed over time, on one shared Mbps axis. */
/** The readings within the first SECONDS of their test. */
const clip = (samples: readonly Sample[]) => samples.filter((sample) => secondsOf(samples, sample) <= SECONDS);

export const SpeedChart = memo(function SpeedChart({ samples: all, live }: SpeedChartProps) {
    const samples = useMemo(() => ({ download: clip(all.download), upload: clip(all.upload) }), [all]);
    const [plotRef, width] = useWidth();
    const [hoverT, setHoverT] = useState<number | null>(null);

    const chart = useMemo(() => {
        const peak = Math.max(peakOf(samples.download), peakOf(samples.upload));
        const yMax = scaleMax(peak);
        const unit = speedUnit(yMax);
        const xMax = SECONDS;

        const plotWidth = Math.max(0, width - PAD.left - PAD.right);
        const plotHeight = HEIGHT - PAD.top - PAD.bottom;
        const x = (t: number) => PAD.left + (t / xMax) * plotWidth;
        const y = (mbps: number) => PAD.top + plotHeight - (mbps / yMax) * plotHeight;

        const lines = DIRECTIONS.map((direction) => {
            const series = samples[direction];
            if (series.length === 0) return { direction, line: "", area: "", end: null };
            const points = series.map((s) => `${x(secondsOf(series, s)).toFixed(1)},${y(s.mbps).toFixed(1)}`);
            const last = series.at(-1)!;
            const endX = x(secondsOf(series, last));
            return {
                direction,
                line: `M${points.join("L")}`,
                area: `M${x(0).toFixed(1)},${y(0)}L${points.join("L")}L${endX.toFixed(1)},${y(0)}Z`,
                end: { x: endX, y: y(last.mbps) },
            };
        });

        const xTicks = [0, 3, 6, 9, 12, 15];
        // Empty, the graph is just its baseline: gridlines without data would cross the placeholder text.
        const yTicks = peak > 0 ? [0, yMax / 2, yMax] : [0];

        return { peak, yMax, unit, xMax, plotWidth, x, y, lines, xTicks, yTicks };
    }, [samples, width]);

    const empty = samples.download.length === 0 && samples.upload.length === 0;

    const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
        if (empty || chart.plotWidth <= 0) return;
        const left = event.currentTarget.getBoundingClientRect().left;
        const t = ((event.clientX - left - PAD.left) / chart.plotWidth) * chart.xMax;
        setHoverT(Math.min(chart.xMax, Math.max(0, t)));
    };

    const hover =
        hoverT === null
            ? null
            : DIRECTIONS.flatMap((direction) => {
                  const series = samples[direction];
                  const sample = sampleAt(series, hoverT);
                  return sample ? [{ direction, sample, t: secondsOf(series, sample) }] : [];
              });
    const hoverX = hoverT === null ? 0 : chart.x(hoverT);

    const summary = empty
        ? "Speed graph, empty until a test runs."
        : `Speed graph. ${DIRECTIONS.filter((d) => samples[d].length > 0)
              .map((d) => `${SERIES[d].label} peaked at ${formatSpeed(peakOf(samples[d]), chart.unit)} ${chart.unit}`)
              .join(", ")}.`;

    return (
        <section className="w-full rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#151A22]">
            <header className="flex items-center justify-between gap-3">
                <h2 className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Speed over time <span className="text-slate-400 dark:text-slate-500">· {chart.unit}</span>
                </h2>
                <ul className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
                    {DIRECTIONS.map((direction) => (
                        <li key={direction} className="flex items-center gap-1.5">
                            <span aria-hidden className={cn("h-0.5 w-3 rounded-full", SERIES[direction].swatch)} />
                            {SERIES[direction].label}
                        </li>
                    ))}
                </ul>
            </header>

            <div
                ref={plotRef}
                role="img"
                aria-label={summary}
                className="relative mt-3 touch-none select-none"
                style={{ height: HEIGHT }}
                onPointerMove={onPointerMove}
                onPointerLeave={() => setHoverT(null)}
            >
                {width > 0 ? (
                    <svg width={width} height={HEIGHT} aria-hidden className="block overflow-visible">
                        <g className="stroke-slate-200 dark:stroke-white/10" strokeWidth="1">
                            {chart.yTicks.map((tick) => (
                                <line
                                    key={tick}
                                    x1={PAD.left}
                                    x2={width - PAD.right}
                                    y1={chart.y(tick)}
                                    y2={chart.y(tick)}
                                    strokeDasharray={tick === 0 ? undefined : "2 3"}
                                />
                            ))}
                        </g>
                        <g className="fill-slate-400 text-[10px] tabular-nums dark:fill-slate-500">
                            {chart.yTicks.map((tick) => (
                                <text key={tick} x={PAD.left - 8} y={chart.y(tick)} dy="0.32em" textAnchor="end">
                                    {formatScale(tick, chart.unit)}
                                </text>
                            ))}
                            {chart.xTicks.map((tick) => (
                                <text key={tick} x={chart.x(tick)} y={HEIGHT - 6} textAnchor="middle">
                                    {tick}s
                                </text>
                            ))}
                        </g>

                        {chart.lines.map(({ direction, line, area }) =>
                            line ? (
                                <g key={direction}>
                                    <path d={area} className={cn(SERIES[direction].fill, "opacity-[0.07]")} />
                                    <path
                                        d={line}
                                        fill="none"
                                        strokeWidth="2"
                                        strokeLinejoin="round"
                                        strokeLinecap="round"
                                        className={SERIES[direction].stroke}
                                    />
                                </g>
                            ) : null,
                        )}

                        {chart.lines.map(({ direction, end }) =>
                            end && direction === live && !hover ? (
                                <circle
                                    key={direction}
                                    cx={end.x}
                                    cy={end.y}
                                    r="4"
                                    strokeWidth="2"
                                    className={cn(SERIES[direction].fill, "stroke-white dark:stroke-[#151A22]")}
                                />
                            ) : null,
                        )}

                        {hover ? (
                            <g>
                                <line
                                    x1={hoverX}
                                    x2={hoverX}
                                    y1={PAD.top}
                                    y2={HEIGHT - PAD.bottom}
                                    strokeWidth="1"
                                    className="stroke-slate-300 dark:stroke-white/20"
                                />
                                {hover.map(({ direction, sample, t }) => (
                                    <circle
                                        key={direction}
                                        cx={chart.x(t)}
                                        cy={chart.y(sample.mbps)}
                                        r="4"
                                        strokeWidth="2"
                                        className={cn(SERIES[direction].fill, "stroke-white dark:stroke-[#151A22]")}
                                    />
                                ))}
                            </g>
                        ) : null}
                    </svg>
                ) : null}

                {empty ? (
                    <p className="absolute inset-0 flex items-center justify-center pl-10 pb-5 text-xs text-slate-400 dark:text-slate-500">
                        Live speeds appear here during the test
                    </p>
                ) : null}

                {hover && hover.length > 0 ? (
                    <div
                        className={cn(
                            "pointer-events-none absolute top-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm",
                            "dark:border-white/10 dark:bg-[#1B212B]",
                        )}
                        style={
                            hoverX > width / 2
                                ? { right: width - hoverX + 10 }
                                : { left: hoverX + 10 }
                        }
                    >
                        <p className="mb-1 tabular-nums text-slate-500 dark:text-slate-400">
                            {(hoverT ?? 0).toFixed(1)} s
                        </p>
                        {hover.map(({ direction, sample }) => (
                            <p key={direction} className="flex items-center gap-2 whitespace-nowrap">
                                <span aria-hidden className={cn("h-2 w-2 rounded-full", SERIES[direction].swatch)} />
                                <span className="text-slate-600 dark:text-slate-300">{SERIES[direction].label}</span>
                                <span className="ml-auto pl-3 font-medium tabular-nums text-slate-900 dark:text-slate-100">
                                    {formatSpeed(sample.mbps, chart.unit)} {chart.unit}
                                </span>
                            </p>
                        ))}
                    </div>
                ) : null}
            </div>
        </section>
    );
});
