import { Xoshiro256StarStar } from './prng';

(BigInt.prototype as unknown as Record<string, unknown>).toJSON = function () {
  return String(this);
};

describe('xoshiro256** Known-Answer Test (KAT)', () => {
  it('matches Blackman & Vigna reference vector for seed [1n, 2n, 3n, 4n]', () => {
    const rng = new Xoshiro256StarStar([1n, 2n, 3n, 4n]);
    const expected = [
      11520n,
      0n,
      1509978240n,
      1215971899390074240n,
    ];

    for (let i = 0; i < expected.length; i++) {
      expect(rng.next().toString()).toBe(expected[i].toString());
    }
  });
});

