/**
 * Deterministic pseudo-randomness for the fixture builders.
 *
 * Replaces `ModelFactory.seed_random(...)` from Python's pytest plugin, which
 * seeded the global `random` module per model. Nothing global is seeded here:
 * a generator is created per builder call from an explicit seed, so two builder
 * calls cannot influence each other through a shared stream and a test file's
 * fixtures do not change when another test is added ahead of it.
 *
 * The algorithm is mulberry32, chosen because it is small enough to read and
 * has no state beyond a single 32-bit word. It is not cryptographic and must
 * never be used for anything but fixtures.
 */

/**
 * The seed every builder uses unless a test asks for another.
 *
 * Python spread four seeds across its models (12, 55, 22, 5). One is enough
 * here because each builder derives its own generator rather than drawing from
 * a shared one.
 */
export const DEFAULT_SEED = 12;

/** A deterministic source of fixture values. */
export type SeededRandom = {
	/** A float in `[0, 1)`. */
	next: () => number;
	/** An integer in `[min, max]`, both inclusive. */
	int: (min: number, max: number) => number;
	/** One of `items`. Throws on an empty array rather than returning undefined. */
	pick: <T>(items: readonly T[]) => T;
	/** `length` lowercase hex characters. */
	hex: (length: number) => string;
};

const HEX_DIGITS = "0123456789abcdef";

export function createSeededRandom(seed: number = DEFAULT_SEED): SeededRandom {
	let state = seed >>> 0;

	function next(): number {
		state = (state + 0x6d2b79f5) >>> 0;

		let t = state;

		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	function int(min: number, max: number): number {
		return min + Math.floor(next() * (max - min + 1));
	}

	return {
		next,
		int,

		pick<T>(items: readonly T[]): T {
			if (items.length === 0) {
				throw new Error("cannot pick from an empty array");
			}

			return items[int(0, items.length - 1)] as T;
		},

		hex(length: number): string {
			let out = "";

			for (let index = 0; index < length; index += 1) {
				out += HEX_DIGITS[int(0, 15)];
			}

			return out;
		},
	};
}
