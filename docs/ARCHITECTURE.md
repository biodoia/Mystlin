# Mysti Architecture

Technical documentation for contributors and developers.

## Table of Contents

- [Project Structure](#project-structure)
- [Core Components](#core-components)
- [Data Flow](#data-flow)
- [Type System](#type-system)
- [Extension Points](#extension-points)

---

## Project Structure

```
Mysti/
├── src/
│   ├── extension.ts           # Extension entry point
│   ├── types.ts               # Shared type definitions
│   ├── managers/              # Business logic managers
│   │   ├── ContextManager.ts
│   │   ├── ConversationManager.ts
│   │   ├── ProviderManager.ts
│   │   ├── BrainstormManager.ts
│   │   ├── PermissionManager.ts
│   │   ├── ResponseClassifier.ts
│   │   ├── PlanOptionManager.ts
│   │   ├── SuggestionManager.ts
│   │   ├── AutocompleteManager.ts
│   │   ├── AgentLoader.ts        # Three-tier agent loading from markdown
│   │   ├── AgentContextManager.ts # Agent recommendations & prompt building
│   │   └── SetupManager.ts       # CLI auto-setup & authentication
│   ├── providers/             # AI provider implementations
│   │   ├── ChatViewProvider.ts
│   │   ├── ProviderRegistry.ts
│   │   ├── base/
│   │   │   ├── IProvider.ts   # Interfaces + persona definitions
│   │   │   └── BaseCliProvider.ts
│   │   ├── claude/
│   │   │   └── ClaudeCodeProvider.ts
│   │   └── codex/
│   │       └── CodexProvider.ts
│   └── webview/
│       └── webviewContent.ts  # HTML/CSS/JS for UI
├── resources/
│   ├── Mysti-Logo.png
│   ├── icon.svg
│   ├── icons/                 # UI icons
│   ├── marked.min.js
│   ├── prism-bundle.js
│   └── mermaid.min.js
├── package.json
├── tsconfig.json
├── webpack.config.js
└── docs/
    ├── FEATURES.md
    └── ARCHITECTURE.md
```

---

## Core Components

### Entry Point: extension.ts

The extension entry point handles:
- Activation and deactivation
- Provider initialization
- Command registration
- View provider registration

```typescript
export function activate(context: vscode.ExtensionContext) {
  // Initialize ChatViewProvider
  // Register commands
  // Set up context subscriptions
}
```

### Managers

#### ContextManager

Manages code context for AI conversations.

**Responsibilities:**
- Track files, selections, folders in context
- Auto-context feature (active editor tracking)
- Language detection (30+ languages)
- Format context for prompts

**Key Methods:**
```typescript
addFile(uri: vscode.Uri): void
addSelection(editor: vscode.TextEditor): void
clearContext(): void
getContextForPrompt(): ContextItem[]
```

#### ConversationManager

Persistent conversation storage using VSCode's globalState.

**Responsibilities:**
- Create, update, delete conversations
- Per-conversation settings storage
- Agent configuration persistence
- Title generation

**Key Methods:**
```typescript
createConversation(settings: Settings): Conversation
addMessage(id: string, message: Message): void
updateAgentConfig(id: string, config: AgentConfiguration): boolean
getAgentConfig(id: string): AgentConfiguration | undefined
```

#### ProviderManager

Facade over the ProviderRegistry for provider management.

**Responsibilities:**
- Provider discovery and initialization
- Active provider management
- Request routing to providers
- Process cancellation

**Key Methods:**
```typescript
sendMessage(content, context, settings, ...): AsyncGenerator<StreamChunk>
sendMessageToProvider(providerId, ...): AsyncGenerator<StreamChunk>
cancelRequest(panelId?: string): void
```

#### BrainstormManager

Orchestrates multi-agent brainstorm sessions.

**Responsibilities:**
- Coordinate multiple AI agents
- Manage brainstorm phases (individual → discussion → synthesis)
- Interleave streaming from multiple providers
- Per-panel session isolation

**Brainstorm Flow:**
```
1. User submits query
2. Individual Phase: Each agent analyzes independently (parallel)
3. Discussion Phase (full mode): Agents review others' responses
4. Synthesis Phase: Designated agent creates unified solution
```

**Key Methods:**
```typescript
startBrainstorm(query, context, config, panelId): AsyncGenerator<BrainstormStreamChunk>
cancelBrainstorm(panelId?: string): void
```

#### PermissionManager

Handles permission requests for file operations.

**Responsibilities:**
- Create permission requests
- Track pending/approved/denied states
- Handle timeouts
- Session-level permissions

**Key Methods:**
```typescript
createRequest(type, details): PermissionRequest
resolveRequest(id, decision): void
checkPermission(type, path): boolean
```

#### ResponseClassifier

AI-powered response analysis using Claude Haiku.

**Responsibilities:**
- Detect clarifying questions in responses
- Identify implementation plan options
- Extract structured data from natural language

**Returns:**
```typescript
interface ResponseClassification {
  questions: ClarifyingQuestion[];
  planOptions: PlanOption[];
  context: string;
}
```

#### SuggestionManager

Generates context-aware quick action suggestions.

**Responsibilities:**
- Generate 6 suggestions per response
- Pre-spawn CLI process (warm process optimization)
- Parse structured suggestion output

#### AutocompleteManager

Provides sentence/paragraph/message completion.

**Responsibilities:**

- Generate completions based on partial input
- Support multiple completion types

#### AgentLoader

Three-tier progressive loading system for agent definitions from markdown files.

**Responsibilities:**

- Load agent metadata from multiple sources (core, plugin, user, workspace)
- Parse YAML frontmatter from markdown files
- Cache agents at each tier for performance
- Provide fast UI rendering with minimal data

**Three-Tier Loading:**

```text
Tier 1: Metadata (AgentMetadata)
├── id, name, description, icon
├── category, source, activationTriggers
└── Always loaded for fast UI

Tier 2: Instructions (AgentInstructions)
├── Extends Tier 1
├── instructions, communicationStyle
├── priorities, bestPractices, antiPatterns
└── Loaded on selection

Tier 3: Full (AgentFull)
├── Extends Tier 2
├── codeExamples, fullContent
└── Loaded on demand for detailed view
```

**Source Priority:**

1. Core agents (`resources/agents/core/`)
2. Plugin agents (`resources/agents/plugins/`)
3. User agents (`~/.mysti/agents/`)
4. Workspace agents (`.mysti/agents/`)

**Key Methods:**

```typescript
loadAllMetadata(): Promise<{ personas: AgentMetadata[]; skills: AgentMetadata[] }>
loadInstructions(agentId: string): Promise<AgentInstructions | null>
loadFull(agentId: string): Promise<AgentFull | null>
findMatchingAgents(query: string): AgentMetadata[]
```

#### AgentContextManager

Builds agent context for prompt injection with token budget management.

**Responsibilities:**

- Get recommendations based on user query
- Build prompt context within token budget
- Provide condensed versions when budget exceeded
- Manage auto-suggest settings

**Key Methods:**

```typescript
getRecommendations(query: string, limit?: number): AgentRecommendation[]
buildPromptContext(config: AgentConfiguration): Promise<AgentPromptContext>
isAutoSuggestEnabled(): boolean
setTokenBudget(maxTokens: number): Promise<void>
```

**Token Budget Behavior:**

- `0` = unlimited (no budget enforcement)
- `> 0` = limit agent context to specified tokens
- When exceeded, uses condensed persona prompt

### Providers

#### ICliProvider Interface

Base interface for all CLI-based providers.

```typescript
interface ICliProvider {
  readonly id: string;
  readonly displayName: string;
  readonly config: ProviderConfig;
  readonly capabilities: ProviderCapabilities;

  initialize(): Promise<void>;
  dispose(): void;
  discoverCli(): Promise<CliDiscoveryResult>;
  getCliPath(): string;
  getAuthConfig(): Promise<AuthConfig>;
  checkAuthentication(): Promise<boolean>;

  sendMessage(
    content: string,
    context: ContextItem[],
    settings: Settings,
    conversation: Conversation | null,
    persona?: PersonaConfig,
    panelId?: string,
    providerManager?: unknown,
    agentConfig?: AgentConfiguration
  ): AsyncGenerator<StreamChunk>;

  cancelCurrentRequest(): void;
  clearSession(): void;
  hasSession(): boolean;
  getSessionId(): string | null;
}
```

#### BaseCliProvider

Abstract base class implementing common CLI functionality.

**Key Methods:**
```typescript
// Build prompt with context, persona, skills
protected buildPrompt(content, context, conversation, settings, persona?, agentConfig?): string

// Build agent instructions from configuration
protected buildAgentInstructions(agentConfig?): string

// Process CLI output stream
protected *processStream(stderrCollector): AsyncGenerator<StreamChunk>
```

#### ClaudeCodeProvider

Claude Code CLI implementation.

**Features:**
- Models: Sonnet 4.5, Opus 4.5, Haiku 3.5
- Streaming JSON output parsing
- Extended thinking support
- Tool use handling
- Session management

**CLI Invocation:**
```bash
claude --output-format stream-json [options]
```

#### CodexProvider

OpenAI Codex CLI implementation.

**Features:**
- Similar structure to ClaudeCodeProvider
- Provider-specific prompt building

### ChatViewProvider

Main UI coordinator and webview provider.

**Responsibilities:**
- Webview creation and management
- Per-panel state (conversations, processes)
- Message routing between webview and managers
- Initial state setup

**Webview Messages:**
```typescript
// Incoming from webview
{ type: 'sendMessage', payload: { content, context } }
{ type: 'newConversation' }
{ type: 'updateAgentConfig', payload: AgentConfiguration }
{ type: 'selectPlan', payload: PlanSelectionResult }

// Outgoing to webview
{ type: 'streamChunk', payload: StreamChunk }
{ type: 'updateState', payload: { conversations, settings } }
{ type: 'showPlanOptions', payload: PlanOption[] }
```

---

## Data Flow

### Message Flow

```
User Input (Webview)
       ↓
ChatViewProvider.handleMessage()
       ↓
ProviderManager.sendMessage()
       ↓
BaseCliProvider.sendMessage()
       ↓
[Spawn CLI Process]
       ↓
BaseCliProvider.processStream()
       ↓
[Parse JSON chunks]
       ↓
StreamChunk events
       ↓
ChatViewProvider → Webview
       ↓
UI Update
```

### Brainstorm Flow

```
User Query
       ↓
BrainstormManager.startBrainstorm()
       ↓
┌──────────────────────────────────────┐
│ Individual Phase (Parallel)          │
│ ┌─────────────┐ ┌─────────────────┐  │
│ │ Claude CLI  │ │ Codex CLI       │  │
│ │ (streaming) │ │ (streaming)     │  │
│ └─────────────┘ └─────────────────┘  │
└──────────────────────────────────────┘
       ↓
[Discussion Phase - Full Mode Only]
       ↓
┌──────────────────────────────────────┐
│ Synthesis Phase                      │
│ ┌─────────────────────────────────┐  │
│ │ Synthesis Agent                 │  │
│ │ Combines all perspectives       │  │
│ └─────────────────────────────────┘  │
└──────────────────────────────────────┘
       ↓
Unified Solution
```

---

## Type System

### Core Types

```typescript
// Operation modes
type OperationMode = 'default' | 'ask-before-edit' | 'edit-automatically' | 'quick-plan' | 'detailed-plan';

// Provider types
type ProviderType = 'claude-code' | 'openai-codex';
type AgentType = 'claude-code' | 'openai-codex';

// Streaming
interface StreamChunk {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result' | 'error' | 'done' | 'session_active';
  content?: string;
  toolCall?: ToolCall;
  sessionId?: string;
  usage?: UsageStats;
}

// Agent configuration
type DeveloperPersonaId = 'architect' | 'prototyper' | ... | 'toolsmith';
type SkillId = 'concise' | 'repo-hygiene' | ... | 'rollback-ready';

interface AgentConfiguration {
  personaId: DeveloperPersonaId | null;
  enabledSkills: SkillId[];
}
```

### Brainstorm Types

```typescript
type BrainstormPhase = 'initial' | 'individual' | 'discussion' | 'synthesis' | 'complete';

interface BrainstormSession {
  id: string;
  query: string;
  phase: BrainstormPhase;
  agents: AgentConfig[];
  agentResponses: Map<AgentType, AgentResponse>;
  discussionRounds: DiscussionRound[];
  unifiedSolution: string | null;
}

interface BrainstormStreamChunk {
  type: 'agent_text' | 'agent_thinking' | 'agent_complete' | 'agent_error' |
        'discussion_text' | 'synthesis_text' | 'phase_change' | 'done';
  agentId?: AgentType;
  content?: string;
  phase?: BrainstormPhase;
}
```

### Permission Types

```typescript
type PermissionActionType = 'file-read' | 'file-create' | 'file-edit' | 'file-delete' |
                            'bash-command' | 'web-request' | 'multi-file-edit';

interface PermissionRequest {
  id: string;
  actionType: PermissionActionType;
  title: string;
  description: string;
  details: PermissionDetails;
  status: PermissionStatus;
  createdAt: number;
  expiresAt: number;
}
```

---

## Extension Points

### Adding a New Provider

1. **Create provider class** extending `BaseCliProvider`:

```typescript
// src/providers/newprovider/NewProvider.ts
export class NewProvider extends BaseCliProvider {
  readonly id = 'new-provider';
  readonly displayName = 'New Provider';
  readonly config: ProviderConfig = {
    name: 'new-provider',
    displayName: 'New Provider',
    models: [...],
    defaultModel: 'model-id'
  };
  readonly capabilities: ProviderCapabilities = {
    supportsStreaming: true,
    supportsThinking: false,
    supportsToolUse: true,
    supportsSessions: false
  };

  protected buildCliArgs(settings: Settings, hasSession: boolean): string[] {
    // Return CLI arguments
  }

  protected parseStreamLine(line: string): StreamChunk | null {
    // Parse provider-specific output format
  }

  // Implement other abstract methods...
}
```

2. **Register in ProviderRegistry**:

```typescript
// src/providers/ProviderRegistry.ts
this._providers.set('new-provider', new NewProvider(context));
```

3. **Update types**:

```typescript
// src/types.ts
export type ProviderType = 'claude-code' | 'openai-codex' | 'new-provider';
```

4. **Update package.json** with configuration options.

### Adding a New Persona

1. **Add to types**:

```typescript
// src/types.ts
export type DeveloperPersonaId = ... | 'new-persona';
```

2. **Define persona**:

```typescript
// src/providers/base/IProvider.ts
export const DEVELOPER_PERSONAS: Record<DeveloperPersonaId, DeveloperPersona> = {
  // ...
  'new-persona': {
    id: 'new-persona',
    name: 'New Persona',
    description: 'Description here',
    icon: '🆕',
    keyCharacteristics: 'Behavior instructions...'
  }
};
```

3. **Add icon** to `resources/icons/`.

### Adding a New Skill

1. **Add to types**:

```typescript
// src/types.ts
export type SkillId = ... | 'new-skill';
```

2. **Define skill**:

```typescript
// src/providers/base/IProvider.ts
export const DEVELOPER_SKILLS: Record<SkillId, Skill> = {
  // ...
  'new-skill': {
    id: 'new-skill',
    name: 'New Skill',
    description: 'Brief description',
    instructions: 'Detailed instructions for the AI...'
  }
};
```

---

## Build & Development

### Commands

```bash
# Install dependencies
npm install

# Development build with watch
npm run watch

# Production build
npm run compile

# Lint
npm run lint

# Package extension
npx vsce package
```

### Debugging

1. Open project in VSCode
2. Press `F5` to launch Extension Development Host
3. Set breakpoints in TypeScript files
4. Check Debug Console for logs

### Logging

All managers and providers log to console with `[Mysti]` prefix:

```typescript
console.log('[Mysti] ProviderManager: Initializing...');
```

Filter logs in Debug Console: `[Mysti]`
