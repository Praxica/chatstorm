# ChatStorm - Claude Code Documentation

## Project Overview

ChatStorm is a Next.js application that facilitates structured multi-agent AI conversations. It allows users to create configurations with multiple AI agents that can participate in various conversation modalities (debates, brainstorms, dialogues, etc.) with sophisticated round-based interactions.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Clerk
- **AI SDKs**: Multiple providers (Anthropic, OpenAI, Google, DeepSeek, Groq, xAI)
- **UI**: React 19, Radix UI, Tailwind CSS
- **State Management**: Zustand
- **Testing**: Jest

## Key Architecture

### Core Domain Models

#### Config
Represents a conversation configuration with:
- Rounds (sequential conversation phases)
- Chat instructions
- Retention and memory settings
- Design settings
- Associated with users or spaces

#### ChatRound
Defines conversation phases with:
- Type: debate, brainstorm, dialogue, explore, critique, review, survey, understand, custom
- Depth levels: minimal, brief, medium, thorough, exhaustive, dynamic
- Participants (ChatAgents)
- Stances (for debates)
- Transition types: user, auto, conditional
- Length configurations
- Data extraction tools

#### ChatAgent
AI participants with:
- Name, role, system prompt
- Model selection (per-agent or per-round)
- Temperature settings
- Avatar
- Project associations
- Dynamic agent support

#### Chat & Messages
- Conversations based on configs
- Branching support for conversation variants
- Message retention and compression
- Round sessions for tracking multi-round conversations
- Memory system for cross-round context

### Modalities System

Located in [lib/chat/modalities/](lib/chat/modalities/), modalities define conversation patterns:

- **BaseModality**: [BaseModality.ts](lib/chat/modalities/BaseModality.ts) - Abstract base class
- **BrainstormModality**: Collaborative idea generation
- **DebateModality**: Adversarial discussion with stances
- **DialogueModality**: Turn-based conversations
- **ExploreModality**: Deep investigation of topics
- **CritiqueModality**: Critical analysis
- **ReviewModality**: Evaluation and assessment
- **SurveyModality**: Structured questioning
- **UnderstandModality**: Comprehension and explanation
- **CustomModality**: User-defined patterns

### Spaces Feature

Multi-tenant workspaces supporting:
- Organization-based isolation
- Space-specific templates and configs
- Token plans and usage tracking
- Member management with roles (owner, admin, member)
- Custom model configurations per space
- Signup modes: closed, open, approval

### Key Services

Located in [lib/services/](lib/services/):

- **AgentService**: Agent CRUD operations
- **ConfigService**: Configuration management
- **ChatService**: Chat lifecycle and operations
- **MessageService**: Message handling
- **BatchService**: Batch chat processing
- **TemplateService**: Template creation and installation
- **SpaceService**: Space management
- **TokenService**: Token usage tracking
- **ModelService**: Model configuration

### State Stores (Zustand)

Located in [lib/stores/](lib/stores/):

- **configsStore**: Configuration state
- **chatsStore**: Chat sessions
- **chatMessagesStore**: Message state
- **chatProgressStore**: Real-time chat progress
- **modelsStore**: Model configurations
- **spacesStore**: Space data
- **dashboardStore**: UI state

### Chat Engine

[lib/chat/ChatEngine.ts](lib/chat/ChatEngine.ts) orchestrates:
- Round execution
- Agent message generation
- Modality-specific logic
- Progress tracking
- Retention and compression
- Memory management

### API Routes

Follow Next.js App Router conventions in [app/api/](app/api/):
- `/api/configs/[configId]/...` - Config operations
- `/api/chats/[chatId]/...` - Chat operations
- `/api/agents/...` - Agent management
- `/api/spaces/...` - Space operations
- `/api/templates/...` - Template operations

## Development Workflow

### Setup
```bash
npm install
# Set up environment variables (database, Clerk, etc.)
npm run dev
```

### Database
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# View database
npx prisma studio
```

### Testing
```bash
npm test
npm run test:watch
```

### Build
```bash
npm run build
npm start
```

## Important Patterns

### Agent Model Selection
Agents can use:
- Default model (from config or global settings)
- Agent-specific model
- Round-specific model override
- Space-constrained models

See [lib/utils/agent-model-validation.ts](lib/utils/agent-model-validation.ts)

### Round Transitions
- **User**: Wait for user input
- **Auto**: Proceed automatically
- **Conditional**: Based on defined conditions

### Data Extraction
Rounds can extract structured data using the `dataTool` JSON configuration stored per round.

### Memory System
- Memory configurations define what to remember
- Memories are created during rounds
- Versioned and scoped to memory config IDs
- Can be round-specific or chat-wide

### Retention & Compression
- Configurable message retention per round
- Automatic compression of round sessions
- Compression data stored as JSON

## Error Handling Best Practices

### Use logError Utility
Always use `logError()` from [lib/utils/error.ts](lib/utils/error.ts) for robust error logging:

```typescript
import { logError } from '@/lib/utils/error';

try {
  // ... code
} catch (err) {
  logError('Context description', err);
  // Handle error appropriately
}
```

**Benefits:**
- Safely handles null/undefined errors
- Unwraps nested error objects
- Provides detailed error analysis (message, name, code, stack)
- Works with Error instances, objects, and strings
- Avoids serialization failures

**API Routes:**
Use `logAndReturnError()` for consistent API error responses:

```typescript
import { logAndReturnError } from '@/lib/utils/error';

try {
  // ... code
} catch (err) {
  const { error, statusCode } = logAndReturnError('Operation name', err);
  return NextResponse.json({ error }, { status: statusCode });
}
```

**Avoid:**
- Direct `console.error(error)` - can crash if error is null/malformed
- String concatenation with error objects
- Assuming error is an Error instance

## Key Files to Understand

1. [lib/chat/ChatEngine.ts](lib/chat/ChatEngine.ts) - Core chat orchestration
2. [lib/models/ConfigModel.ts](lib/models/ConfigModel.ts) - Config data model
3. [lib/chat/modalities/BaseModality.ts](lib/chat/modalities/BaseModality.ts) - Modality base
4. [lib/stores/configsStore.ts](lib/stores/configsStore.ts) - Config state management
5. [prisma/schema.prisma](prisma/schema.prisma) - Database schema
6. [components/rounds/add/RoundAddWizard.tsx](components/rounds/add/RoundAddWizard.tsx) - Round creation UI

## Common Tasks

### Adding a New Round Type
1. Add enum to [prisma/schema.prisma](prisma/schema.prisma) `RoundType`
2. Create modality in [lib/chat/modalities/](lib/chat/modalities/)
3. Register in [lib/chat/modalities/ModalityRegistry.ts](lib/chat/modalities/ModalityRegistry.ts)
4. Add UI components in [components/rounds/](components/rounds/)
5. Update constants in [lib/constants/rounds.ts](lib/constants/rounds.ts)

### Adding a New AI Provider
1. Add to [package.json](package.json) (e.g., `@ai-sdk/provider`)
2. Add to [prisma/schema.prisma](prisma/schema.prisma) `ProviderType` enum
3. Update model utilities in [lib/utils/models.ts](lib/utils/models.ts)
4. Add adapter if needed in [lib/chat/adapters/](lib/chat/adapters/)

### Creating a Space Template
1. Create config via UI
2. Use [components/spaces/CreateTemplateModal.tsx](components/spaces/CreateTemplateModal.tsx)
3. Template saved to database with space association
4. Auto-install configuration available for new members

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk public key
- `CLERK_SECRET_KEY` - Clerk secret
- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc. - AI provider keys

## Notes for AI Assistants

- The project is actively being developed with a wizard feature for round creation
- Round configuration is complex with many interdependent settings
- Space awareness is integrated throughout (see `-space-aware` files)
- The UI uses shadcn components with Radix primitives
- All database operations go through Prisma
- Real-time updates use Zustand stores and React hooks
