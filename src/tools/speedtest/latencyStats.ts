/**
 * Turns a list of round-trip times into the two numbers the app shows.
 * Pure functions, no I/O, so they can be tested with plain arrays.
 *
 * - ping:   the median round trip. The middle value ignores isolated slow
 *           samples and, unlike the minimum, isn't flattering.
 * - jitter: the mean absolute difference between consecutive round trips
 *           (the packet delay variation of RFC 3393), leaving out isolated spikes.
 */

export interface LatencyStats {
    /** Median round trip, ms. */
    ping: number;
    /** Mean absolute difference between consecutive round trips, ms. */
    jitter: number;
    min: number;
    max: number;
    /** Samples the ping is based on. */
    samples: number;
    /** Samples left out of the jitter as isolated spikes. */
    spikes: number;
}

/**
 * A sample is a spike when it lies this many robust standard deviations above
 * the median (the modified z-score rule of Iglewicz and Hoaglin). Set to
 * Infinity to count every spike in the jitter.
 */
export const SPIKE_CUTOFF = 3.5;

/** Never set aside more than this share of the samples: past it, the link is simply unsteady. */
export const MAX_SPIKE_SHARE = 0.2;

/** Timers are coarse, so even a perfectly flat link scatters by about this much (ms). */
const MIN_SPREAD_MS = 1;

/** Fewer samples than this can't tell a spike from normal scatter. */
const MIN_SAMPLES_FOR_SPIKES = 5;

export function median(values: readonly number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Flags isolated slow samples. Only the slow side counts: a round trip can't
 * be unusually fast, so a low value is never a spike.
 */
export function findSpikes(
    samples: readonly number[],
    cutoff: number = SPIKE_CUTOFF,
    maxShare: number = MAX_SPIKE_SHARE,
): boolean[] {
    const none = samples.map(() => false);
    if (samples.length < MIN_SAMPLES_FOR_SPIKES) return none;

    const centre = median(samples);
    const madScaled = 1.4826 * median(samples.map((sample) => Math.abs(sample - centre)));
    const limit = centre + cutoff * Math.max(madScaled, MIN_SPREAD_MS);

    const flags = samples.map((sample) => sample > limit);
    const flagged = flags.filter(Boolean).length;
    return flagged > Math.floor(samples.length * maxShare) ? none : flags;
}

/** Null when there are no samples. */
export function summarizeLatency(samples: readonly number[]): LatencyStats | null {
    if (samples.length === 0) return null;

    const spikes = findSpikes(samples);

    // A pair is skipped when either side is a spike, so a spike doesn't bleed
    // into its neighbours, and two samples that were not adjacent are never compared.
    let total = 0;
    let pairs = 0;
    for (let i = 1; i < samples.length; i++) {
        if (spikes[i] || spikes[i - 1]) continue;
        total += Math.abs(samples[i] - samples[i - 1]);
        pairs++;
    }

    return {
        ping: median(samples),
        jitter: pairs > 0 ? total / pairs : 0,
        min: Math.min(...samples),
        max: Math.max(...samples),
        samples: samples.length,
        spikes: spikes.filter(Boolean).length,
    };
}
