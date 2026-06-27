"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  Neura: () => Neura,
  NeuraHttpError: () => NeuraHttpError
});
module.exports = __toCommonJS(index_exports);

// src/payment.ts
var USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
async function handlePaymentRequired(autoPay, x402) {
  if (autoPay.onPaymentRequired) {
    return await autoPay.onPaymentRequired(x402);
  }
  if (autoPay.privateKey) {
    return await sendUsdcPayment(autoPay.privateKey, x402, autoPay.rpcUrl);
  }
  return null;
}
async function sendUsdcPayment(privateKey, x402, rpcUrl) {
  const rpc = rpcUrl || "https://mainnet.base.org";
  try {
    return await sendViaEthers(privateKey, x402, rpc);
  } catch (err) {
    if (err instanceof Error && err.message.includes("Cannot find module")) {
      throw new Error(
        "ethers is required for autoPay with privateKey. Install it: npm install ethers\nAlternatively, use onPaymentRequired callback instead."
      );
    }
    throw err;
  }
}
async function sendViaEthers(privateKey, x402, rpcUrl) {
  const { ethers } = await import("ethers");
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const amountRaw = ethers.parseUnits(x402.amount, 6);
  const usdcInterface = new ethers.Interface([
    "function transfer(address to, uint256 amount) returns (bool)"
  ]);
  const data = usdcInterface.encodeFunctionData("transfer", [x402.recipient, amountRaw]);
  const tx = await wallet.sendTransaction({
    to: USDC_CONTRACT,
    data
    // Gas limits — wallet.sendTransaction estimates automatically
  });
  const receipt = await tx.wait(2);
  if (!receipt || receipt.status === 0) {
    throw new Error(`USDC transfer failed: transaction reverted`);
  }
  return receipt.hash;
}
async function waitForConfirmations(txHash, minConfirmations = 2, rpcUrl, maxWaitMs = 6e4) {
  const rpc = rpcUrl || "https://mainnet.base.org";
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    try {
      const blockRes = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 })
      });
      const blockData = await blockRes.json();
      const currentBlock = parseInt(blockData.result, 16);
      const receiptRes = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getTransactionReceipt",
          params: [txHash],
          id: 2
        })
      });
      const receiptData = await receiptRes.json();
      const receipt = receiptData.result;
      if (receipt) {
        const txBlock = parseInt(receipt.blockNumber, 16);
        const confirmations = currentBlock - txBlock + 1;
        if (confirmations >= minConfirmations) {
          return;
        }
      }
    } catch {
    }
    await new Promise((resolve) => setTimeout(resolve, 2e3));
  }
  throw new Error(`Transaction ${txHash} did not reach ${minConfirmations} confirmations within ${maxWaitMs / 1e3}s`);
}

// src/client.ts
var NeuraHttpError = class extends Error {
  code;
  status;
  action;
  retryAfter;
  rateLimit;
  x402;
  constructor(status, error, rateLimit) {
    super(error.message);
    this.name = "NeuraHttpError";
    this.code = error.code;
    this.status = status;
    this.action = error.action;
    this.retryAfter = error.retry_after;
    this.rateLimit = rateLimit;
    this.x402 = error.x402;
  }
};
var HttpClient = class {
  baseUrl;
  apiKey;
  maxRetries;
  autoPay;
  constructor(options) {
    this.baseUrl = (options.baseUrl || "https://neura.sh").replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.maxRetries = options.maxRetries ?? 3;
    this.autoPay = options.autoPay;
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
          if (res.status === 402 && this.autoPay && error.x402) {
            const txHash = await handlePaymentRequired(this.autoPay, error.x402);
            if (txHash) {
              await waitForConfirmations(txHash, 2, this.autoPay.rpcUrl);
              const verifyRes = await fetch(`${this.baseUrl}/api/payments/verify`, {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${this.apiKey}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({ payment_tx: txHash })
              });
              if (!verifyRes.ok) {
                const verifyErr = await verifyRes.json().catch(() => ({}));
                throw new NeuraHttpError(verifyRes.status, verifyErr.error || error, rateLimit);
              }
              continue;
            }
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
  /** Store a memory with auto-embedding. */
  async create(input, idempotencyKey) {
    const { data } = await this.client.request("POST", "/api/memory", input, { idempotencyKey });
    return data;
  }
  /** Search memories by semantic similarity. */
  async search(query, limit = 10) {
    const { data } = await this.client.request(
      "GET",
      `/api/memory?query=${encodeURIComponent(query)}&limit=${limit}`
    );
    return data;
  }
  /** Advanced search with filters (tags, date range, metadata). */
  async searchAdvanced(input) {
    const { data } = await this.client.request("POST", "/api/memory/search", input);
    return data;
  }
  /** Get the most recent memories. */
  async recent(limit = 10) {
    const { data } = await this.client.request("GET", `/api/memory?limit=${limit}`);
    return data;
  }
  /** Update a memory. If content changes, embedding auto-regenerates. */
  async update(id, input) {
    const { data } = await this.client.request("PATCH", `/api/memory/${id}`, input);
    return data;
  }
  /** Delete a memory by ID. */
  async delete(id) {
    await this.client.request("DELETE", `/api/memory/${id}`);
  }
  /** Store multiple memories at once (max 25). Costs 1 credit each. */
  async batchCreate(inputs) {
    const { data } = await this.client.request("POST", "/api/memory/batch", { memories: inputs });
    return data;
  }
  /** Delete multiple memories by IDs (max 100). Free operation. */
  async batchDelete(ids) {
    const { data } = await this.client.request("DELETE", "/api/memory/batch", { ids });
    return data;
  }
  /** Summarize recent memories via LLM. Costs 5 credits. */
  async summarize(limit = 20, query) {
    const { data } = await this.client.request("POST", "/api/memory/summarize", { limit, query });
    return data;
  }
  /** Share a memory with another tenant. */
  async share(id, tenantId, permission = "read") {
    await this.client.request("POST", `/api/memory/${id}/share`, { tenant_id: tenantId, permission });
  }
  /** List memories shared with this tenant by other agents. */
  async sharedWithMe() {
    const { data } = await this.client.request("GET", "/api/shared-with-me");
    return data;
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

// src/webhook.ts
var WebhookAPI = class {
  constructor(client) {
    this.client = client;
  }
  client;
  /** Register a webhook for event notifications. */
  async create(input) {
    const { data } = await this.client.request("POST", "/api/webhooks", input);
    return data;
  }
  /** List all registered webhooks. */
  async list() {
    const { data } = await this.client.request("GET", "/api/webhooks");
    return data;
  }
  /** Get webhook details by ID. */
  async get(id) {
    const { data } = await this.client.request("GET", `/api/webhooks/${id}`);
    return data;
  }
  /** Update a webhook. */
  async update(id, input) {
    const { data } = await this.client.request("PATCH", `/api/webhooks/${id}`, input);
    return data;
  }
  /** Delete a webhook. */
  async delete(id) {
    await this.client.request("DELETE", `/api/webhooks/${id}`);
  }
  /** Trigger retry of all failed webhook deliveries due for retry. */
  async retryFailed() {
    const { data } = await this.client.request(
      "POST",
      "/api/webhooks/retry"
    );
    return data;
  }
};

// src/admin.ts
var AdminAPI = class {
  constructor(client) {
    this.client = client;
  }
  client;
  /** List all API keys for this tenant. */
  async listKeys() {
    const { data } = await this.client.request("GET", "/api/admin/keys");
    return data;
  }
  /** Create a new API key. Returns the raw key once. */
  async createKey(label) {
    const { data } = await this.client.request("POST", "/api/admin/keys", { label });
    return data;
  }
  /** Revoke (deactivate) an API key by ID. */
  async revokeKey(id) {
    await this.client.request("DELETE", `/api/admin/keys/${id}`);
  }
  /** List credit transaction history. */
  async listTransactions(limit = 20) {
    const { data } = await this.client.request("GET", `/api/admin/transactions?limit=${limit}`);
    return data;
  }
  /** Get usage statistics. */
  async getUsage(days = 7) {
    const { data } = await this.client.request("GET", `/api/admin/usage?days=${days}`);
    return data;
  }
};
var CreditsAPI = class {
  constructor(client) {
    this.client = client;
  }
  client;
  /** Get current credit balance and pricing info. */
  async balance() {
    const { data } = await this.client.request(
      "GET",
      "/api/credits"
    );
    return data;
  }
};

// src/index.ts
var Neura = class {
  /** Memory operations — store, search, batch, update, delete, share */
  memory;
  /** State operations — key-value persistent storage */
  state;
  /** Webhook operations — register, list, manage webhook endpoints */
  webhooks;
  /** Admin operations — API keys, transactions, usage stats */
  admin;
  /** Credits operations — check balance */
  credits;
  /** Low-level HTTP client (access for advanced use) */
  http;
  constructor(options) {
    this.http = new HttpClient(options);
    this.memory = new MemoryAPI(this.http);
    this.state = new StateAPI(this.http);
    this.webhooks = new WebhookAPI(this.http);
    this.admin = new AdminAPI(this.http);
    this.credits = new CreditsAPI(this.http);
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Neura,
  NeuraHttpError
});
