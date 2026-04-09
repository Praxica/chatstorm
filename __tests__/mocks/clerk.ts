/**
 * Mock for @clerk/nextjs/server
 *
 * Provides a configurable auth() mock that returns a test Clerk user ID.
 * Integration tests seed a User record with externalId matching this value,
 * so getAuthenticatedUserId() resolves to the correct internal user ID.
 *
 * Usage in tests:
 *   import { setTestClerkId } from '@/__tests__/mocks/clerk'
 *   setTestClerkId('clerk_test_user_001')  // default
 *   setTestClerkId(null)                   // simulate unauthenticated
 */

let _clerkUserId: string | null = 'clerk_test_user_001'
let _clerkEmail: string | null = 'test@chatstorm.dev'

export function setTestClerkId(id: string | null) {
  _clerkUserId = id
}

export function setTestClerkEmail(email: string | null) {
  _clerkEmail = email
}

export function resetTestClerkId() {
  _clerkUserId = 'clerk_test_user_001'
  _clerkEmail = 'test@chatstorm.dev'
}

// Mock auth() — returns the configured Clerk user ID
export async function auth() {
  return { userId: _clerkUserId }
}

// Mock currentUser() — returns a minimal user object
export async function currentUser() {
  if (!_clerkUserId) return null
  return {
    id: _clerkUserId,
    primaryEmailAddress: _clerkEmail ? { emailAddress: _clerkEmail } : null,
    emailAddresses: _clerkEmail ? [{ emailAddress: _clerkEmail }] : [],
  }
}

// Stub out middleware-related exports
export function clerkMiddleware() {
  return (req: any, res: any, next: any) => next?.()
}

export function getAuth() {
  return { userId: _clerkUserId }
}
