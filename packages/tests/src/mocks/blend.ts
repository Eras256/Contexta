/**
 * Blend Protocol mock — supply/withdraw and position queries against a fake
 * lending pool. Mirrors the shape of the Blend SDK's pool interactions so the
 * integration module can be swapped for the real testnet contracts later.
 */
export interface BlendPosition {
  poolId: string;
  asset: string;
  suppliedBaseUnits: string;
  borrowedBaseUnits: string;
  supplyApyBps: number;
  borrowApyBps: number;
}

export interface BlendMock {
  getPosition(poolId: string, asset: string): Promise<BlendPosition>;
  supply(poolId: string, asset: string, amountBaseUnits: string): Promise<BlendPosition>;
  withdraw(poolId: string, asset: string, amountBaseUnits: string): Promise<BlendPosition>;
}

export function createBlendMock(): BlendMock {
  const positions = new Map<string, BlendPosition>();
  const key = (poolId: string, asset: string) => `${poolId}:${asset}`;
  const get = (poolId: string, asset: string): BlendPosition =>
    positions.get(key(poolId, asset)) ?? {
      poolId,
      asset,
      suppliedBaseUnits: "0",
      borrowedBaseUnits: "0",
      supplyApyBps: 540,
      borrowApyBps: 1180,
    };

  return {
    async getPosition(poolId, asset) {
      return get(poolId, asset);
    },
    async supply(poolId, asset, amountBaseUnits) {
      const pos = get(poolId, asset);
      pos.suppliedBaseUnits = (BigInt(pos.suppliedBaseUnits) + BigInt(amountBaseUnits)).toString();
      positions.set(key(poolId, asset), pos);
      return pos;
    },
    async withdraw(poolId, asset, amountBaseUnits) {
      const pos = get(poolId, asset);
      const next = BigInt(pos.suppliedBaseUnits) - BigInt(amountBaseUnits);
      if (next < 0n) throw new Error("Insufficient Blend supply balance");
      pos.suppliedBaseUnits = next.toString();
      positions.set(key(poolId, asset), pos);
      return pos;
    },
  };
}
