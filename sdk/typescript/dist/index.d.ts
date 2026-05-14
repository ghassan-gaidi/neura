/** Options for creating a Neura client */
interface NeuraOptions {
    /** API key (sk-...) */
    apiKey: string;
    /** Base URL (default: https://neura.sh) */
    baseUrl?: string;
    /** Max retries on failure (default: 3) */
    maxRetries?: number;
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
/** A state entry */
interface StateEntry {
    key: string;
    value: unknown;
    created_at: string;
    updated_at: string;
}
/** API error returned by the server */
interface NeuraApiError {
    code: string;
    message: string;
    action?: string;
    retry_after?: number;
    docs_url?: string;
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
    constructor(status: number, error: NeuraApiError, rateLimit?: RateLimitInfo);
}
/**
 * Low-level HTTP client with retry support.
 * Handles auth headers, JSON parsing, and error formatting.
 */
declare class HttpClient {
    private baseUrl;
    private apiKey;
    private maxRetries;
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
    /**
     * Store a memory with auto-embedding.
     * The content is automatically embedded via OpenAI.
     */
    create(input: CreateMemoryInput, idempotencyKey?: string): Promise<Memory>;
    /**
     * Search memories by semantic similarity.
     * Returns memories ranked by relevance score.
     *
     * @example
     * const results = await neura.memory.search('What are my risk preferences?')
     */
    search(query: string, limit?: number): Promise<Memory[]>;
    /**
     * Advanced search with filters.
     * Supports date ranges, metadata matching, and tag filtering.
     */
    searchAdvanced(input: SearchMemoryInput): Promise<Memory[]>;
    /**
     * Get the most recent memories.
     */
    recent(limit?: number): Promise<Memory[]>;
    /**
     * Update a memory's content, metadata, tags, or importance.
     * If content changes, the embedding is automatically regenerated.
     */
    update(id: string, input: UpdateMemoryInput): Promise<Memory>;
    /**
     * Delete a memory by ID.
     */
    delete(id: string): Promise<void>;
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

/**
 * Neura — External Brain for AI Agents
 *
 * Gives AI agents persistent memory and state via a simple HTTP API.
 * Create a client with your API key and start storing/retrieving memories instantly.
 */
declare class Neura {
    /** Memory operations — store, search, update, delete */
    memory: MemoryAPI;
    /** State operations — key-value persistent storage */
    state: StateAPI;
    /** Low-level HTTP client (access for advanced use) */
    http: HttpClient;
    /**
     * Create a new Neura client.
     *
     * @param options.apiKey - Your API key (sk-...)
     * @param options.baseUrl - API base URL (default: https://neura.sh)
     * @param options.maxRetries - Max retries on failure (default: 3)
     */
    constructor(options: NeuraOptions);
}

export { type ApiResponse, type CreateMemoryInput, type Memory, Neura, NeuraHttpError, type NeuraOptions, type RateLimitInfo, type SearchFilters, type SearchMemoryInput, type StateEntry, type UpdateMemoryInput };
