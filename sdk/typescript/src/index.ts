// ============================================================
// Neura SDK — Main Entry Point
// ============================================================
//
// Usage:
//   import { Neura } from 'neura'
//   const neura = new Neura({ apiKey: 'sk-...' })
//
//   // Store and search memories
//   await neura.memory.create({ content: 'User prefers dark mode', tags: ['preference'] })
//   const results = await neura.memory.search('What are my preferences?')
//
//   // Manage agent state
//   await neura.state.set('current_goal', { task: 'Build the API' })
//   const goal = await neura.state.get('current_goal')

import { HttpClient, NeuraHttpError } from './client'
import { MemoryAPI } from './memory'
import { StateAPI } from './state'
import type { NeuraOptions } from './types'

/**
 * Neura — External Brain for AI Agents
 * 
 * Gives AI agents persistent memory and state via a simple HTTP API.
 * Create a client with your API key and start storing/retrieving memories instantly.
 */
export class Neura {
  /** Memory operations — store, search, update, delete */
  public memory: MemoryAPI
  /** State operations — key-value persistent storage */
  public state: StateAPI
  /** Low-level HTTP client (access for advanced use) */
  public http: HttpClient

  /**
   * Create a new Neura client.
   * 
   * @param options.apiKey - Your API key (sk-...)
   * @param options.baseUrl - API base URL (default: https://neura.sh)
   * @param options.maxRetries - Max retries on failure (default: 3)
   */
  constructor(options: NeuraOptions) {
    this.http = new HttpClient(options)
    this.memory = new MemoryAPI(this.http)
    this.state = new StateAPI(this.http)
  }
}

// Re-export types and errors
export type { NeuraOptions, Memory, StateEntry, CreateMemoryInput, UpdateMemoryInput, SearchMemoryInput, SearchFilters, ApiResponse, RateLimitInfo } from './types'
export { NeuraHttpError }
