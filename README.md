# ChatStorm

Structured multi-agent AI conversations with round-based interactions and configurable modalities.

## Features

- **Multi-agent conversations** -- configure multiple AI agents with distinct roles, system prompts, and model selections
- **9 conversation modalities** -- debate, brainstorm, dialogue, explore, critique, review, survey, understand, and custom
- **Round-based flow** -- sequential conversation phases with user, auto, or conditional transitions
- **Multiple AI providers** -- Anthropic, OpenAI, Google, DeepSeek, Groq, and xAI via the Vercel AI SDK
- **Spaces** -- multi-tenant team workspaces with member management, token plans, and per-space model constraints
- **Memory and retention** -- cross-round context with configurable message retention and compression
- **Batch processing** -- run conversations at scale across configurations

## Tech Stack

- Next.js 15 (App Router), TypeScript, React 19
- PostgreSQL with Prisma ORM
- Clerk authentication
- Tailwind CSS, Radix UI, shadcn/ui
- Zustand for state management
- Jest with Testcontainers for testing

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL
- Docker (required for integration tests)

### Installation

```bash
git clone https://github.com/heyrbg/chatstorm.git
cd chatstorm
npm install
```

### Environment

Copy `.env` and fill in the required values:

```bash
cp .env .env.local
```

Required variables:

```
DATABASE_URL=postgresql://...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

Add additional provider keys (Google, DeepSeek, Groq, xAI) as needed.

### Database Setup

```bash
npx prisma generate
npx prisma migrate dev
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Testing

```bash
# Run all tests (unit + integration)
npm test

# Unit tests only (no Docker required)
npm run test:unit

# Integration tests only (requires Docker)
npm run test:integration

# Watch mode
npm run test:watch
```

Integration tests use [Testcontainers](https://testcontainers.com/) to spin up ephemeral PostgreSQL instances. Docker must be running.

## Project Structure

```
app/                  # Next.js App Router pages and API routes
components/           # React components
lib/
  chat/               # Chat engine, modalities, adapters, services
  services/           # Domain services (Config, Chat, Space, etc.)
  stores/             # Zustand state stores
  schemas/            # Zod validation schemas
  utils/              # Shared utilities
prisma/               # Database schema and migrations
__tests__/            # Test suites (unit, integration, mocks, factories)
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on submitting issues and pull requests.

## License

ChatStorm is released under the [O'Saasy License](LICENSE.md).
