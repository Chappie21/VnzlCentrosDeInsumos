import { Injectable, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

  // Fixed-window limiter. ponytail: good enough for abuse/DDoS guard.
  // Upgrade path: sliding-window Lua script if bursts at window edges matter.
  async hit(key: string, limit: number, windowSec: number): Promise<boolean> {
    const n = await this.client.incr(key);
    if (n === 1) await this.client.expire(key, windowSec);
    return n <= limit;
  }

  // read-through cache helper for the public directory
  async cached<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T> {
    const hit = await this.client.get(key);
    if (hit) return JSON.parse(hit) as T;
    const val = await fn();
    await this.client.set(key, JSON.stringify(val), "EX", ttlSec);
    return val;
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}
