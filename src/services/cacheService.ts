interface CacheStore {
  get<T = any>(key: string): Promise<T | null>;
  set(key: string, value: any, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  flush(): Promise<void>;
}

class MemoryStore implements CacheStore {
  private cache = new Map<string, { value: any; expiresAt: number }>();

  async get<T = any>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    this.cache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async flush(): Promise<void> {
    this.cache.clear();
  }
}

class RedisStore implements CacheStore {
  private client: any;

  constructor(redisUrl: string) {
    try {
      // Dynamic require to avoid compile/runtime failure if package is missing
      const redis = require('redis');
      this.client = redis.createClient({ url: redisUrl });
      this.client.on('error', (err: any) => console.error('Redis Client Error', err));
      this.client.connect().catch((err: any) => {
        console.error('Failed to connect to Redis, caching will not work via Redis', err);
      });
    } catch (e) {
      console.warn('redis package not found. Redis caching will fall back to in-memory store.');
      throw e;
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    if (!this.client || !this.client.isOpen) return null;
    try {
      const val = await this.client.get(key);
      return val ? JSON.parse(val) as T : null;
    } catch (e) {
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    if (!this.client || !this.client.isOpen) return;
    try {
      await this.client.set(key, JSON.stringify(value), {
        EX: ttlSeconds
      });
    } catch (e) {
      // ignore cache set error
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client || !this.client.isOpen) return;
    try {
      await this.client.del(key);
    } catch (e) {
      // ignore
    }
  }

  async flush(): Promise<void> {
    if (!this.client || !this.client.isOpen) return;
    try {
      await this.client.flushAll();
    } catch (e) {
      // ignore
    }
  }
}

let store: CacheStore;
const redisUrl = process.env.REDIS_URL;

if (redisUrl) {
  try {
    store = new RedisStore(redisUrl);
    console.log('CacheService: Initialized with Redis store.');
  } catch (e) {
    store = new MemoryStore();
    console.log('CacheService: Initialized with Memory store fallback.');
  }
} else {
  store = new MemoryStore();
  console.log('CacheService: Initialized with Memory store.');
}

export const cacheService = store;
