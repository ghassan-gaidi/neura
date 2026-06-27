/** Options for creating a Neura client */
interface NeuraOptions {
    /** API key (sk-...) */
    apiKey: string;
    /** Base URL (default: https://neura.sh) */
    baseUrl?: string;
    /** Max retries on failure (default: 3) */
    maxRetries?: number;
    /** Autonomous payment handling (x402). */
    autoPay?: AutoPayOptions;
}
/** x402 payment details from the API */
interface X402Details {
    chain: string;
    token: string;
    amount: string;
    recipient: string;
    description: string;
    credits: number;
}
/** Configuration for autonomous payment handling */
interface AutoPayOptions {
    onPaymentRequired?: (x402: X402Details) => Promise<string>;
    privateKey?: string;
    rpcUrl?: string;
}
/** A stored memory entry */
interface Memory {
    id: string;
    content: string;
    metadata?: Record<string, unknown>;
    tags?: string[];
    importance: number;
    score?: number;
    expires_at?: string;
    created_at: string;
    updated_at: string;
}
/** Input for creating a memory */
interface CreateMemoryInput {
    content: string;
    metadata?: Record<string, unknown>;
    tags?: string[];
    importance?: number;
    expires_at?: string;
}
/** Input for updating a memory */
interface UpdateMemoryInput {
    content?: string;
    metadata?: Record<string, unknown>;
    tags?: string[];
    importance?: number;
}
/** Search filters */
interface SearchFilters {
    tags?: string[];
    importance_min?: number;
    importance_max?: number;
    metadata?: Record<string, unknown>;
    date_from?: string;
    date_to?: string;
}
/** Advanced search input */
interface SearchMemoryInput {
    query?: string;
    filters?: SearchFilters;
    limit?: number;
    min_score?: number;
}
/** Batch create result */
interface BatchCreateResult {
    stored: number;
    memories: Memory[];
}
/** Batch delete result */
interface BatchDeleteResult {
    deleted: number;
    ids: string[];
}
/** Summarize result */
interface SummarizeResult {
    summary: string;
    memory_count: number;
}
/** A state entry */
interface StateEntry {
    key: string;
    value: unknown;
    created_at: string;
    updated_at: string;
}
type WebhookEvent = 'memory.created' | 'memory.updated' | 'memory.deleted' | 'memory.expiring' | 'state.changed' | 'memory.shared' | 'credits.low';
/** A registered webhook */
interface Webhook {
    id: string;
    url: string;
    events: WebhookEvent[];
    is_active: boolean;
    secret?: string | null;
    created_at: string;
    updated_at: string;
}
/** Input for creating a webhook */
interface CreateWebhookInput {
    url: string;
    events: WebhookEvent[];
    secret?: string;
}
/** An API key metadata */
interface ApiKeyMeta {
    id: string;
    label: string;
    is_active: boolean;
    created_at: string;
    last_used_at: string | null;
}
/** API key creation result (includes raw key once) */
interface ApiKeyCreateResult extends ApiKeyMeta {
    raw_key: string;
}
/** A credit transaction */
interface Transaction {
    id: string;
    amount: number;
    transaction_type: string;
    description?: string;
    created_at: string;
}
/** Usage statistics */
interface UsageStats {
    total_requests: number;
    credits_used: number;
    credits_purchased: number;
    by_endpoint: Record<string, number>;
    by_day: Record<string, number>;
}
/** Credit balance and pricing */
interface CreditsBalance {
    balance: number;
    pricing: Record<string, number>;
    top_up: {
        via: {
            chain: string;
            token: string;
            recipient: string;
            pricePerThousand: string;
            minTopUp: number;
        };
        url: string;
    };
}
/** API error returned by the server */
interface NeuraApiError {
    code: string;
    message: string;
    action?: string;
    retry_after?: number;
    docs_url?: string;
    x402?: X402Details;
}
/** Generic API response wrapper */
interface ApiResponse<T> {
    data: T;
    meta?: {
        total?: number;
        query?: string;
        credits_remaining?: number;
    };
}
/** Rate limit headers returned by the API */
interface RateLimitInfo {
    limit: number;
    remaining: number;
    resetMs: number;
}

declare class NeuraHttpError extends Error {
    code: string;
    status: number;
    action?: string;
    retryAfter?: number;
    rateLimit?: RateLimitInfo;
    x402?: X402Details;
    constructor(status: number, error: NeuraApiError, rateLimit?: RateLimitInfo);
}
/**
 * Low-level HTTP client with retry and auto-payment support.
 */
declare class HttpClient {
    private baseUrl;
    private apiKey;
    private maxRetries;
    private autoPay?;
    constructor(options: NeuraOptions);
    request<T>(method: string, path: string, body?: unknown, options?: {
        idempotencyKey?: string;
    }): Promise<{
        data: T;
        meta?: Record<string, unknown>;
        rateLimit?: RateLimitInfo;
    }>;
}

declare class MemoryAPI {
    private client;
    constructor(client: HttpClient);
    /** Store a memory with auto-embedding. */
    create(input: CreateMemoryInput, idempotencyKey?: string): Promise<Memory>;
    /** Search memories by semantic similarity. */
    search(query: string, limit?: number): Promise<Memory[]>;
    /** Advanced search with filters (tags, date range, metadata). */
    searchAdvanced(input: SearchMemoryInput): Promise<Memory[]>;
    /** Get the most recent memories. */
    recent(limit?: number): Promise<Memory[]>;
    /** Update a memory. If content changes, embedding auto-regenerates. */
    update(id: string, input: UpdateMemoryInput): Promise<Memory>;
    /** Delete a memory by ID. */
    delete(id: string): Promise<void>;
    /** Store multiple memories at once (max 25). Costs 1 credit each. */
    batchCreate(inputs: CreateMemoryInput[]): Promise<BatchCreateResult>;
    /** Delete multiple memories by IDs (max 100). Free operation. */
    batchDelete(ids: string[]): Promise<BatchDeleteResult>;
    /** Summarize recent memories via LLM. Costs 5 credits. */
    summarize(limit?: number, query?: string): Promise<SummarizeResult>;
    /** Share a memory with another tenant. */
    share(id: string, tenantId: string, permission?: 'read' | 'write'): Promise<void>;
    /** List memories shared with this tenant by other agents. */
    sharedWithMe(): Promise<Memory[]>;
}

declare class StateAPI {
    private client;
    constructor(client: HttpClient);
    /**
     * Set a key-value state entry.
     * Overwrites any existing value for the same key.
     *
     * @example
     * await neura.state.set('current_goal', { task: 'Build API', priority: 'high' })
     */
    set(key: string, value: unknown, idempotencyKey?: string): Promise<StateEntry>;
    /**
     * Get a specific state value by key.
     * Throws NeuraHttpError with code 'not_found' if key doesn't exist.
     */
    get(key: string): Promise<StateEntry>;
    /**
     * List all state entries for this agent.
     */
    list(): Promise<StateEntry[]>;
    /**
     * Delete a state entry by key.
     */
    delete(key: string): Promise<void>;
}

declare class WebhookAPI {
    private client;
    constructor(client: HttpClient);
    /** Register a webhook for event notifications. */
    create(input: CreateWebhookInput): Promise<Webhook>;
    /** List all registered webhooks. */
    list(): Promise<Webhook[]>;
    /** Get webhook details by ID. */
    get(id: string): Promise<Webhook>;
    /** Update a webhook. */
    update(id: string, input: Partial<CreateWebhookInput>): Promise<Webhook>;
    /** Delete a webhook. */
    delete(id: string): Promise<void>;
    /** Trigger retry of all failed webhook deliveries due for retry. */
    retryFailed(): Promise<{
        processed: number;
        succeeded: number;
        failed: number;
    }>;
}

declare class AdminAPI {
    private client;
    constructor(client: HttpClient);
    /** List all API keys for this tenant. */
    listKeys(): Promise<ApiKeyMeta[]>;
    /** Create a new API key. Returns the raw key once. */
    createKey(label?: string): Promise<ApiKeyCreateResult>;
    /** Revoke (deactivate) an API key by ID. */
    revokeKey(id: string): Promise<void>;
    /** List credit transaction history. */
    listTransactions(limit?: number): Promise<Transaction[]>;
    /** Get usage statistics. */
    getUsage(days?: number): Promise<UsageStats>;
}
/** Credits operations */
declare class CreditsAPI {
    private client;
    constructor(client: HttpClient);
    /** Get current credit balance and pricing info. */
    balance(): Promise<{
        balance: number;
        pricing: Record<string, number>;
    }>;
}

/**
 * Neura — External Brain for AI Agents
 *
 * Gives AI agents persistent memory, state, webhooks, and admin capabilities
 * via a simple HTTP API.
 */
declare class Neura {
    /** Memory operations — store, search, batch, update, delete, share */
    memory: MemoryAPI;
    /** State operations — key-value persistent storage */
    state: StateAPI;
    /** Webhook operations — register, list, manage webhook endpoints */
    webhooks: WebhookAPI;
    /** Admin operations — API keys, transactions, usage stats */
    admin: AdminAPI;
    /** Credits operations — check balance */
    credits: CreditsAPI;
    /** Low-level HTTP client (access for advanced use) */
    http: HttpClient;
    constructor(options: NeuraOptions);
}

export { type ApiKeyCreateResult, type ApiKeyMeta, type ApiResponse, type AutoPayOptions, type BatchCreateResult, type BatchDeleteResult, type CreateMemoryInput, type CreateWebhookInput, type CreditsBalance, type Memory, Neura, NeuraHttpError, type NeuraOptions, type RateLimitInfo, type SearchFilters, type SearchMemoryInput, type StateEntry, type SummarizeResult, type Transaction, type UpdateMemoryInput, type UsageStats, type Webhook, type WebhookEvent, type X402Details };
