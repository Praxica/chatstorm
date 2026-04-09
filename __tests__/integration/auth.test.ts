/**
 * Integration test: verifies auth mock + Testcontainers DB work together.
 *
 * The globalSetup seeds a User record with:
 *   id: '00000000-0000-0000-0000-000000000001'
 *   externalId: 'clerk_test_user_001'
 *
 * The Clerk mock returns clerkId: 'clerk_test_user_001' by default.
 * So getAuthenticatedUserId() should resolve to the seeded user's internal ID.
 */
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUserId, UnauthorizedError } from '@/lib/utils/auth'
import { setTestClerkId, setTestClerkEmail, resetTestClerkId } from '@/__tests__/mocks/clerk'

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001'

afterEach(() => {
  resetTestClerkId()
})

describe('getAuthenticatedUserId', () => {
  it('resolves to the seeded test user', async () => {
    const userId = await getAuthenticatedUserId()
    expect(userId).toBe(TEST_USER_ID)
  })

  it('throws UnauthorizedError when not authenticated', async () => {
    setTestClerkId(null)
    await expect(getAuthenticatedUserId()).rejects.toThrow(UnauthorizedError)
  })

  it('throws UnauthorizedError for unknown clerk ID', async () => {
    setTestClerkId('clerk_unknown_999')
    setTestClerkEmail(null) // No email fallback either
    await expect(getAuthenticatedUserId()).rejects.toThrow(UnauthorizedError)
  })
})

describe('test database connectivity', () => {
  it('can query the seeded user', async () => {
    const user = await prisma.user.findUnique({
      where: { id: TEST_USER_ID },
    })
    expect(user).not.toBeNull()
    expect(user?.email).toBe('test@chatstorm.dev')
    expect(user?.externalId).toBe('clerk_test_user_001')
  })

  it('can create and query records', async () => {
    const config = await prisma.config.create({
      data: {
        title: 'Integration Test Config',
        userId: TEST_USER_ID,
      },
    })
    expect(config.id).toBeDefined()
    expect(config.title).toBe('Integration Test Config')
    expect(config.userId).toBe(TEST_USER_ID)

    // Clean up
    await prisma.config.delete({ where: { id: config.id } })
  })
})
