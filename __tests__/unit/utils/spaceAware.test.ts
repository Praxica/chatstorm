/**
 * Tests for space-aware utility functions.
 *
 * Covers:
 *   - getSpaceId: extracts spaceId from request URL params or headers
 *   - addSpaceFilter: augments Prisma where clauses with spaceId filtering
 *   - filterModelsBySpaceSettings: filters model records by space config
 *   - getDefaultModelForContext: resolves the default model for a context
 *   - isModelAvailableInContext: checks model availability
 */

import { NextRequest } from 'next/server'
import { getSpaceId, addSpaceFilter } from '@/lib/utils/space-aware'
import {
  filterModelsBySpaceSettings,
  getDefaultModelForContext,
  isModelAvailableInContext,
} from '@/lib/utils/space-aware-models'
import type { ModelConfig } from '@/lib/utils/models'
import type { SpaceModelSettings } from '@/lib/schemas/prisma-typed'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal ModelConfig factory for tests */
function makeModel(overrides: Partial<ModelConfig> & { id: string }): ModelConfig {
  return {
    provider: 'openai',
    name: overrides.id,
    description: `Test model ${overrides.id}`,
    maxOutputTokens: 4096,
    temperatureMultiplier: 1,
    ...overrides,
  }
}

/** Build a Record<string, ModelConfig> from a list of model IDs */
function makeModels(...ids: string[]): Record<string, ModelConfig> {
  return Object.fromEntries(ids.map((id) => [id, makeModel({ id })]))
}

/** Build a SpaceModelSettings object with sensible defaults */
function makeSpaceSettings(
  overrides: Partial<SpaceModelSettings> = {},
): SpaceModelSettings {
  return {
    mode: 'all',
    defaultModel: null,
    includedModels: [],
    excludedModels: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// getSpaceId
// ---------------------------------------------------------------------------

describe('getSpaceId', () => {
  it('extracts spaceId from URL searchParams', () => {
    const req = new NextRequest('http://localhost/api/test?spaceId=space-1')
    expect(getSpaceId(req)).toBe('space-1')
  })

  it('extracts spaceId from x-space-id header', () => {
    const req = new NextRequest('http://localhost/api/test', {
      headers: { 'x-space-id': 'space-2' },
    })
    expect(getSpaceId(req)).toBe('space-2')
  })

  it('returns null when neither param nor header is present', () => {
    const req = new NextRequest('http://localhost/api/test')
    expect(getSpaceId(req)).toBeNull()
  })

  it('URL params take precedence over headers when both are set', () => {
    const req = new NextRequest('http://localhost/api/test?spaceId=from-url', {
      headers: { 'x-space-id': 'from-header' },
    })
    expect(getSpaceId(req)).toBe('from-url')
  })

  it('works with a standard Request object (searchParams)', () => {
    const req = new Request('http://localhost/api/test?spaceId=space-3')
    expect(getSpaceId(req)).toBe('space-3')
  })

  it('works with a standard Request object (header)', () => {
    const req = new Request('http://localhost/api/test', {
      headers: { 'x-space-id': 'space-4' },
    })
    expect(getSpaceId(req)).toBe('space-4')
  })

  it('returns null for empty spaceId param', () => {
    // searchParams.get returns '' for ?spaceId= which is falsy
    const req = new NextRequest('http://localhost/api/test?spaceId=')
    expect(getSpaceId(req)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// addSpaceFilter
// ---------------------------------------------------------------------------

describe('addSpaceFilter', () => {
  it('adds spaceId to where clause when spaceId is provided', () => {
    const where = { userId: 'user-1' }
    const result = addSpaceFilter(where, 'space-1')
    expect(result).toEqual({ userId: 'user-1', spaceId: 'space-1' })
  })

  it('adds spaceId: null when spaceId is null (non-space context)', () => {
    const where = { userId: 'user-1' }
    const result = addSpaceFilter(where, null)
    expect(result).toEqual({ userId: 'user-1', spaceId: null })
  })

  it('preserves all existing where clause properties', () => {
    const where = { userId: 'user-1', isActive: true, name: 'test' }
    const result = addSpaceFilter(where, 'space-1')
    expect(result).toEqual({
      userId: 'user-1',
      isActive: true,
      name: 'test',
      spaceId: 'space-1',
    })
  })

  it('works with an empty where clause', () => {
    const result = addSpaceFilter({}, 'space-1')
    expect(result).toEqual({ spaceId: 'space-1' })
  })

  it('does not mutate the original where clause', () => {
    const where = { userId: 'user-1' }
    addSpaceFilter(where, 'space-1')
    expect(where).toEqual({ userId: 'user-1' })
    expect((where as Record<string, unknown>).spaceId).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// filterModelsBySpaceSettings
// ---------------------------------------------------------------------------

describe('filterModelsBySpaceSettings', () => {
  const allModels = makeModels('gpt-4o', 'claude-3-opus', 'gemini-pro', 'deepseek-v3')

  it('returns all models when settings is null', () => {
    const result = filterModelsBySpaceSettings(allModels, null)
    expect(result).toEqual(allModels)
  })

  it('returns all models when mode is "all"', () => {
    const settings = makeSpaceSettings({ mode: 'all' })
    const result = filterModelsBySpaceSettings(allModels, settings)
    expect(result).toEqual(allModels)
  })

  it('includes only specified models in "include" mode', () => {
    const settings = makeSpaceSettings({
      mode: 'include',
      includedModels: ['gpt-4o', 'claude-3-opus'],
    })
    const result = filterModelsBySpaceSettings(allModels, settings)
    expect(Object.keys(result)).toEqual(['gpt-4o', 'claude-3-opus'])
  })

  it('returns empty record when include list is empty', () => {
    const settings = makeSpaceSettings({
      mode: 'include',
      includedModels: [],
    })
    const result = filterModelsBySpaceSettings(allModels, settings)
    expect(result).toEqual({})
  })

  it('excludes specified models in "exclude" mode', () => {
    const settings = makeSpaceSettings({
      mode: 'exclude',
      excludedModels: ['gemini-pro', 'deepseek-v3'],
    })
    const result = filterModelsBySpaceSettings(allModels, settings)
    expect(Object.keys(result)).toEqual(['gpt-4o', 'claude-3-opus'])
  })

  it('returns all models when exclude list is empty', () => {
    const settings = makeSpaceSettings({
      mode: 'exclude',
      excludedModels: [],
    })
    const result = filterModelsBySpaceSettings(allModels, settings)
    expect(result).toEqual(allModels)
  })

  it('handles include with model IDs not in allModels gracefully', () => {
    const settings = makeSpaceSettings({
      mode: 'include',
      includedModels: ['nonexistent-model'],
    })
    const result = filterModelsBySpaceSettings(allModels, settings)
    expect(result).toEqual({})
  })

  it('handles exclude with model IDs not in allModels gracefully', () => {
    const settings = makeSpaceSettings({
      mode: 'exclude',
      excludedModels: ['nonexistent-model'],
    })
    const result = filterModelsBySpaceSettings(allModels, settings)
    expect(result).toEqual(allModels)
  })

  it('returns all models for an unrecognized mode (default branch)', () => {
    const settings = makeSpaceSettings({ mode: 'unknown' as SpaceModelSettings['mode'] })
    const result = filterModelsBySpaceSettings(allModels, settings)
    expect(result).toEqual(allModels)
  })

  it('works with an empty allModels record', () => {
    const settings = makeSpaceSettings({
      mode: 'include',
      includedModels: ['gpt-4o'],
    })
    const result = filterModelsBySpaceSettings({}, settings)
    expect(result).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// getDefaultModelForContext
// ---------------------------------------------------------------------------

describe('getDefaultModelForContext', () => {
  const availableModels = makeModels('gpt-4o', 'claude-3-opus', 'gemini-pro')

  it('prefers space default when available and in available models', () => {
    const settings = makeSpaceSettings({ defaultModel: 'claude-3-opus' })
    const result = getDefaultModelForContext(availableModels, settings)
    expect(result).toBe('claude-3-opus')
  })

  it('falls back to user default when space default is not in available models', () => {
    const settings = makeSpaceSettings({ defaultModel: 'nonexistent-model' })
    const result = getDefaultModelForContext(availableModels, settings, 'gpt-4o')
    expect(result).toBe('gpt-4o')
  })

  it('falls back to user default when space settings is null', () => {
    const result = getDefaultModelForContext(availableModels, null, 'gemini-pro')
    expect(result).toBe('gemini-pro')
  })

  it('falls back to user default when space settings is undefined', () => {
    const result = getDefaultModelForContext(availableModels, undefined, 'gemini-pro')
    expect(result).toBe('gemini-pro')
  })

  it('falls back to user default when space default is null', () => {
    const settings = makeSpaceSettings({ defaultModel: null })
    const result = getDefaultModelForContext(availableModels, settings, 'gpt-4o')
    expect(result).toBe('gpt-4o')
  })

  it('falls back to first available model when neither space nor user default is specified', () => {
    const result = getDefaultModelForContext(availableModels)
    expect(result).toBe('gpt-4o')
  })

  it('falls back to first model when user default is not in available models', () => {
    const result = getDefaultModelForContext(availableModels, null, 'nonexistent-model')
    expect(result).toBe('gpt-4o')
  })

  it('returns null when no models are available', () => {
    const result = getDefaultModelForContext({})
    expect(result).toBeNull()
  })

  it('returns null when no models available and both defaults are set', () => {
    const settings = makeSpaceSettings({ defaultModel: 'claude-3-opus' })
    const result = getDefaultModelForContext({}, settings, 'gpt-4o')
    expect(result).toBeNull()
  })

  it('prefers space default over user default when both are valid', () => {
    const settings = makeSpaceSettings({ defaultModel: 'gemini-pro' })
    const result = getDefaultModelForContext(availableModels, settings, 'gpt-4o')
    expect(result).toBe('gemini-pro')
  })
})

// ---------------------------------------------------------------------------
// isModelAvailableInContext
// ---------------------------------------------------------------------------

describe('isModelAvailableInContext', () => {
  const availableModels = makeModels('gpt-4o', 'claude-3-opus')

  it('returns true for an available model', () => {
    expect(isModelAvailableInContext('gpt-4o', availableModels)).toBe(true)
  })

  it('returns true for another available model', () => {
    expect(isModelAvailableInContext('claude-3-opus', availableModels)).toBe(true)
  })

  it('returns false for an unavailable model', () => {
    expect(isModelAvailableInContext('gemini-pro', availableModels)).toBe(false)
  })

  it('returns false for an empty string model ID', () => {
    expect(isModelAvailableInContext('', availableModels)).toBe(false)
  })

  it('returns false when available models record is empty', () => {
    expect(isModelAvailableInContext('gpt-4o', {})).toBe(false)
  })
})
