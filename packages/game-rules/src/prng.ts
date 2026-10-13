/**
 * Browser-safe 64-bit pure BigInt xoshiro256** PRNG implementation.
 * Blackman & Vigna (2021) reference algorithm.
 * Zero Node crypto or external dependencies.
 */
export class Xoshiro256StarStar {
  private s: [bigint, bigint, bigint, bigint];

  constructor(seed: [bigint, bigint, bigint, bigint]) {
    this.s = [seed[0], seed[1], seed[2], seed[3]];
  }

  private static rotl(x: bigint, k: bigint): bigint {
    const x64 = BigInt.asUintN(64, x);
    return BigInt.asUintN(64, (x64 << k) | (x64 >> (64n - k)));
  }

  next(): bigint {
    const result = BigInt.asUintN(64, Xoshiro256StarStar.rotl(this.s[1] * 5n, 7n) * 9n);
    const t = BigInt.asUintN(64, this.s[1] << 17n);

    this.s[2] ^= this.s[0];
    this.s[3] ^= this.s[1];
    this.s[1] ^= this.s[2];
    this.s[0] ^= this.s[3];

    this.s[2] ^= t;
    this.s[3] = Xoshiro256StarStar.rotl(this.s[3], 45n);

    return result;
  }
}
