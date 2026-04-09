# Contributing to ChatStorm

## Getting Started

1. Fork the repository and clone your fork.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env` to `.env.local` and fill in the required environment variables (database URL, Clerk keys, AI provider keys).
4. Set up the database:
   ```bash
   npx prisma migrate dev
   ```
5. Start the development server:
   ```bash
   npm run dev
   ```

## Project Structure

- `app/` -- Next.js App Router pages and API routes
- `lib/` -- Core business logic, services, chat engine, state stores
- `components/` -- React components (UI built with Radix/shadcn and Tailwind)
- `prisma/` -- Database schema and migrations
- `__tests__/` -- Test suites (unit and integration)

## Testing

Run the full test suite:
```bash
npm test
```

**Docker is required.** Integration tests use Testcontainers to spin up a real PostgreSQL instance automatically. Make sure Docker is running before you run tests.

For faster feedback during development, run unit tests only:
```bash
npm test -- --testPathPattern=unit
```

Test factories in `__tests__/factories/` provide helpers for creating test data. Use them instead of constructing test objects by hand.

Guidelines:
- Feature PRs should include tests.
- Bug fix PRs that add regression tests are appreciated but not required.
- Tests run automatically in CI on every pull request.

## Pull Requests

- Keep PRs focused on a single change.
- Write a clear description of what changed and why.
- Make sure all tests pass before requesting review.
- Rebase on `main` if your branch falls behind.

## Code Style

- TypeScript everywhere. Avoid plain JavaScript.
- Prefer functional patterns, `const` by default, async/await over raw promises.
- ESLint and Prettier handle formatting. Run `npm run lint` to check.
- Follow the patterns you see in the existing codebase.
- Use `logError()` from `lib/utils/error.ts` for error handling instead of raw `console.error`.
