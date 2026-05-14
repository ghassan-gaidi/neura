// src/client.ts
var NeuraHttpError = class extends Error {
  code;
  status;
  action;
  retryAfter;
  rateLimit;
  constructor(status, error, rateLimit) {
    super(error.message);
    this.name = "NeuraHttpError";
    this.code = error.code;
    this.status = status;
    this.action = error.action;
    this.retryAfter = error.retry_after;
    this.rateLimit = rateLimit;
  }
};
var HttpClient = class {
  baseUrl;
  apiKey;
  maxRetries;
  constructor(options) {
    this.baseUrl = (options.baseUrl || "https://neura.sh").replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.maxRetries = options.maxRetries ?? 3;
  }
  async request(method, path, body, options) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      "Authorization": `Bearer ${this.apiKey}`,
      "Content-Type": "application/json"
    };
    if (options?.idempotencyKey) {
      headers["Idempotency-Key"] = options.idempotencyKey;
    }
    let lastError = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : void 0
        });
        const rateLimit = res.headers.has("X-RateLimit-Limit") ? {
          limit: parseInt(res.headers.get("X-RateLimit-Limit"), 10),
          remaining: parseInt(res.headers.get("X-RateLimit-Remaining"), 10),
          resetMs: parseInt(res.headers.get("X-RateLimit-Reset") || "60", 10) * 1e3
        } : void 0;
        if (!res.ok) {
          const errorBody = await res.json().catch(() => ({
            error: { code: "unknown", message: res.statusText }
          }));
          const error = errorBody.error || { code: "unknown", message: "Unknown error" };
          if (res.status === 429 && attempt < this.maxRetries) {
            const retryAfter = error.retry_after || Math.pow(2, attempt);
            await sleep(retryAfter * 1e3);
            continue;
          }
          if (res.status === 402) {
            throw new NeuraHttpError(res.status, error, rateLimit);
          }
          throw new NeuraHttpError(res.status, error, rateLimit);
        }
        const json = await res.json();
        return {
          data: json.data,
          meta: json.meta,
          rateLimit
        };
      } catch (err) {
        if (err instanceof NeuraHttpError) throw err;
        lastError = new NeuraHttpError(0, {
          code: "network_error",
          message: `Request failed: ${err.message}`,
          action: "retry"
        });
        if (attempt < this.maxRetries) {
          await sleep(Math.pow(2, attempt) * 500);
        }
      }
    }
    throw lastError || new NeuraHttpError(0, {
      code: "max_retries",
      message: "Max retries exceeded",
      action: "check_network"
    });
  }
};
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// src/memory.ts
var MemoryAPI = class {
  constructor(client) {
    this.client = client;
  }
  client;
  /**
   * Store a memory with auto-embedding.
   * The content is automatically embedded via OpenAI.
   */
  async create(input, idempotencyKey) {
    const { data } = await this.client.request("POST", "/api/memory", input, {
      idempotencyKey
    });
    return data;
  }
  /**
   * Search memories by semantic similarity.
   * Returns memories ranked by relevance score.
   * 
   * @example
   * const results = await neura.memory.search('What are my risk preferences?')
   */
  async search(query, limit = 10) {
    const { data } = await this.client.request(
      "GET",
      `/api/memory?query=${encodeURIComponent(query)}&limit=${limit}`
    );
    return data;
  }
  /**
   * Advanced search with filters.
   * Supports date ranges, metadata matching, and tag filtering.
   */
  async searchAdvanced(input) {
    const { data } = await this.client.request("POST", "/api/memory/search", input);
    return data;
  }
  /**
   * Get the most recent memories.
   */
  async recent(limit = 10) {
    const { data } = await this.client.request("GET", `/api/memory?limit=${limit}`);
    return data;
  }
  /**
   * Update a memory's content, metadata, tags, or importance.
   * If content changes, the embedding is automatically regenerated.
   */
  async update(id, input) {
    const { data } = await this.client.request("PATCH", `/api/memory/${id}`, input);
    return data;
  }
  /**
   * Delete a memory by ID.
   */
  async delete(id) {
    await this.client.request("DELETE", `/api/memory/${id}`);
  }
};

// src/state.ts
var StateAPI = class {
  constructor(client) {
    this.client = client;
  }
  client;
  /**
   * Set a key-value state entry.
   * Overwrites any existing value for the same key.
   * 
   * @example
   * await neura.state.set('current_goal', { task: 'Build API', priority: 'high' })
   */
  async set(key, value, idempotencyKey) {
    const { data } = await this.client.request("POST", "/api/state", { key, value }, {
      idempotencyKey
    });
    return data;
  }
  /**
   * Get a specific state value by key.
   * Throws NeuraHttpError with code 'not_found' if key doesn't exist.
   */
  async get(key) {
    const { data } = await this.client.request("GET", `/api/state/${encodeURIComponent(key)}`);
    return data;
  }
  /**
   * List all state entries for this agent.
   */
  async list() {
    const { data } = await this.client.request("GET", "/api/state");
    return data;
  }
  /**
   * Delete a state entry by key.
   */
  async delete(key) {
    await this.client.request("DELETE", `/api/state/${encodeURIComponent(key)}`);
  }
};

// src/index.ts
var Neura = class {
  /** Memory operations — store, search, update, delete */
  memory;
  /** State operations — key-value persistent storage */
  state;
  /** Low-level HTTP client (access for advanced use) */
  http;
  /**
   * Create a new Neura client.
   * 
   * @param options.apiKey - Your API key (sk-...)
   * @param options.baseUrl - API base URL (default: https://neura.sh)
   * @param options.maxRetries - Max retries on failure (default: 3)
   */
  constructor(options) {
    this.http = new HttpClient(options);
    this.memory = new MemoryAPI(this.http);
    this.state = new StateAPI(this.http);
  }
};
export {
  Neura,
  NeuraHttpError
};
