# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mysti is a VSCode extension providing a unified AI coding assistant interface supporting multiple AI backends (Claude Code CLI and OpenAI Codex CLI). It features sidebar/tab chat panels, conversation persistence, multi-agent brainstorm mode, permission controls, and plan selection.

## Build Commands

```bash
npm run compile      # Production build (webpack)
npm run watch        # Development build with watch mode
npm run lint         # ESLint check
npm run test         # Run tests
npx vsce package     # Package extension as .vsix
```

Output: `dist/extension.js` from entry point `src/extension.ts`

## Development

Press `F5` in VSCode to launch Extension Development Host for debugging. Set breakpoints in TypeScript files and filter Debug Console with `[Mysti]` for extension logs.

## Architecture

### Core Pattern: Manager + Provider Facades

```
extension.ts (entry)
    │
    ├── Managers (business logic)
    │   ├── ContextManager        - File/selection tracking
    │   ├── ConversationManager   - Message persistence via globalState
    │   ├── ProviderManager       - Provider registry facade
    │   ├── PermissionManager     - Access control
    │   ├── BrainstormManager     - Multi-agent orchestration
    │   ├── ResponseClassifier    - AI-powered response analysis
    │   ├── PlanOptionManager     - Implementation plan extraction
    │   ├── SuggestionManager     - Quick action suggestions
    │   ├── SetupManager          - CLI auto-setup & authentication
    │   ├── AgentLoader           - Three-tier agent loading from markdown
    │   └── AgentContextManager   - Recommendations & prompt building
    │
    └── ChatViewProvider (UI coordinator)
            │
            └── Providers (CLI integrations)
                ├── ClaudeCodeProvider (extends BaseCliProvider)
                └── CodexProvider (extends BaseCliProvider)
```

### Key Design Decisions

- **Per-panel isolation**: Each webview panel (sidebar or tab) has independent state, conversation, and child process
- **CLI-based providers**: Spawn `claude`/`codex` CLI with `--output-format stream-json`, parse line-delimited JSON events
- **AsyncGenerator streaming**: Providers yield `StreamChunk` items for real-time response updates
- **Webview communication**: Extension ↔ webview via `postMessage()` with typed `WebviewMessage`

### Provider Data Flow

1. User message → ChatViewProvider._handleMessage()
2. Context collection → ContextManager.getContext()
3. Provider selection → ProviderManager._getActiveProvider()
4. CLI spawn → Provider.sendMessage() returns AsyncGenerator<StreamChunk>
5. Stream parsing → parseStreamLine() yields chunks (text, thinking, tool_use, etc.)
6. UI update → postMessage() back to webview

## Key Types (src/types.ts)

- `StreamChunk` - Events from provider CLI (text, thinking, tool_use, tool_result, error, done)
- `WebviewMessage` - Extension ↔ webview communication
- `Message` / `Conversation` - Persistent chat data
- `OperationMode` - "ask-before-edit" | "edit-automatically" | "plan"
- `AccessLevel` - "read-only" | "ask-permission" | "full-access"

## Conventions

- Private members use leading underscore: `_extensionContext`, `_currentProcess`
- Console logging with `[Mysti]` prefix
- Managers are single-responsibility classes
- New providers extend `BaseCliProvider` and implement `ICliProvider`

## VSCode Integration Points

- View: `mysti.chatView` (webview sidebar)
- Commands: `mysti.openChat`, `mysti.newConversation`, `mysti.addToContext`, `mysti.clearContext`, `mysti.openInNewTab`
- Settings namespace: `mysti.*` (13 settings covering provider, mode, access, brainstorm)

## Webview UI

`src/webview/webviewContent.ts` contains embedded HTML/CSS/JS (large file). Uses:
- Marked.js for markdown rendering
- Prism.js for syntax highlighting
- Mermaid.js for diagrams
- Resources loaded from `resources/` folder

## Extension Points

### Adding a New Provider

1. Create class extending `BaseCliProvider` in `src/providers/newprovider/`
2. Implement abstract methods: `discoverCli()`, `getCliPath()`, `buildCliArgs()`, `parseStreamLine()`, `getThinkingTokens()`
3. Register in `src/providers/ProviderRegistry.ts`
4. Add to `ProviderType` union in `src/types.ts`
5. Add configuration options in `package.json`

### Adding a New Persona (Markdown-based)

Create a markdown file in one of the agent source directories:

1. **Core**: `resources/agents/core/personas/my-persona.md`
2. **User**: `~/.mysti/agents/personas/my-persona.md`
3. **Workspace**: `.mysti/agents/personas/my-persona.md`

**Markdown format:**

```markdown
---
id: my-persona
name: My Persona
description: Brief description for UI display
icon: 🎯
category: general
activationTriggers:
  - keyword1
  - keyword2
---

## Key Characteristics

Main instructions for the AI...

## Priorities

1. First priority
2. Second priority

## Best Practices

- Practice one
- Practice two

## Anti-Patterns to Avoid

- Avoid this
- Avoid that
```

### Adding a New Skill (Markdown-based)

Create a markdown file in one of the agent source directories:

1. **Core**: `resources/agents/core/skills/my-skill.md`
2. **User**: `~/.mysti/agents/skills/my-skill.md`
3. **Workspace**: `.mysti/agents/skills/my-skill.md`

**Markdown format:**

```markdown
---
id: my-skill
name: My Skill
description: Brief description
icon: ⚡
category: workflow
activationTriggers:
  - trigger1
---

## Instructions

Detailed instructions for the AI when this skill is enabled...
```

### Legacy: Static Personas/Skills (Fallback)

For backward compatibility, static definitions still exist:

1. Add ID to `DeveloperPersonaId` in `src/types.ts`
2. Define persona in `DEVELOPER_PERSONAS` record in `src/providers/base/IProvider.ts`
3. Add icon to `resources/icons/`
