# Mysti Features Guide

This document provides detailed documentation for all Mysti features.

## Table of Contents

- [Chat Interface](#chat-interface)
- [Providers](#providers)
- [Brainstorm Mode](#brainstorm-mode)
- [Agent Configuration](#agent-configuration)
- [Plan Selection](#plan-selection)
- [Permission System](#permission-system)
- [Settings Reference](#settings-reference)

---

## Chat Interface

### Basic Usage

The Mysti chat interface is accessible from the Activity Bar sidebar or as a standalone editor tab.

**Opening the Chat:**
- Click the Mysti icon in the Activity Bar
- Use keyboard shortcut: `Ctrl+Shift+M` (Windows/Linux) or `Cmd+Shift+M` (Mac)
- Run command: `Mysti: Open Mysti Chat`

**Opening in New Tab:**
- Use keyboard shortcut: `Ctrl+Shift+N` (Windows/Linux) or `Cmd+Shift+N` (Mac)
- Click the "Open in New Tab" button in the chat header

### Context Management

Add relevant code context to improve AI responses.

**Adding Context:**
- Right-click a file in Explorer → "Add to Mysti Context"
- Right-click selected code in Editor → "Add to Mysti Context"
- Context items appear in the context panel

**Auto-Context:**
When enabled (`mysti.autoContext: true`), Mysti automatically tracks your active editor and includes relevant context.

**Clearing Context:**
- Click the clear button in the context panel
- Run command: `Mysti: Clear Context`

### Conversation Management

**New Conversation:**
- Click the "New" button in the header
- Run command: `Mysti: New Conversation`

**Conversation History:**
- Access previous conversations from the history panel
- Each conversation persists across VSCode sessions
- Per-conversation settings (mode, model, provider) are preserved

---

## Providers

Mysti supports multiple AI providers through their CLI interfaces.

### Claude Code

**Setup:**
1. Install Claude Code CLI: `npm install -g @anthropic-ai/claude-code`
2. Authenticate: `claude login`
3. Set as default: `"mysti.defaultProvider": "claude-code"`

**Available Models:**
- `claude-sonnet-4-5-20250929` - Fast, capable (default)
- `claude-opus-4-5-20250929` - Most capable
- `claude-3-5-haiku-20241022` - Fastest, lightweight

**Features:**
- Streaming responses
- Extended thinking
- Tool use
- Session management

### OpenAI Codex

**Setup:**
1. Install Codex CLI following OpenAI's instructions
2. Authenticate with your API key
3. Set as default: `"mysti.defaultProvider": "openai-codex"`

**Switching Providers:**
- Use the provider selector in the toolbar
- Each conversation remembers its provider

---

## Brainstorm Mode

Brainstorm mode enables multiple AI agents to collaborate on complex problems.

### How It Works

1. **Individual Analysis** - Each agent independently analyzes the problem
2. **Discussion Phase** (Full mode only) - Agents review and comment on each other's responses
3. **Synthesis** - A designated agent synthesizes all perspectives into a unified solution

### Quick Mode vs Full Mode

**Quick Mode** (`mysti.brainstorm.discussionMode: "quick"`):
- Agents provide individual responses
- Direct synthesis without explicit discussion
- Faster results

**Full Mode** (`mysti.brainstorm.discussionMode: "full"`):
- Agents review each other's responses
- 1-3 discussion rounds (configurable)
- More thorough exploration of the problem

### Configuration

```json
{
  "mysti.brainstorm.enabled": true,
  "mysti.brainstorm.discussionMode": "full",
  "mysti.brainstorm.discussionRounds": 2,
  "mysti.brainstorm.synthesisAgent": "claude-code"
}
```

### Enabling Brainstorm

1. Click the "Agent" button in the toolbar
2. Toggle "Brainstorm Mode" in the dropdown
3. Select which agents to include

---

## Agent Configuration

Customize AI behavior with personas and skills.

### Developer Personas

Select a persona to shape the AI's approach and focus.

| Persona | Icon | Description | Key Behaviors |
|---------|------|-------------|---------------|
| **Architect** | 🏛️ | Designs the big picture | Focus on scalable, modular systems. Create system diagrams. Define clear module boundaries. Document architectural decisions. |
| **Prototyper** | 🚀 | Moves fast to test ideas | Quick iteration and PoCs. Small, rapid commits. WIP prefixes. Minimal boilerplate. |
| **Product-Centric** | 📦 | User experience as north star | Close alignment with design. Feature flags. User-facing documentation. |
| **Refactorer** | 🔄 | Makes code cleaner | Dedicated refactoring PRs. Consistent naming. Increase test coverage. Remove dead code. |
| **DevOps Engineer** | ⚙️ | Reliable pipelines and operations | CI/CD optimization. Infrastructure-as-Code. Monitoring and alerting. |
| **Domain Expert** | 🎯 | Understands the business problem | Model domain entities precisely. Business rule tests. Bounded contexts. |
| **Researcher** | 🔬 | Solves hard technical problems | Algorithm documentation. Complexity analysis. Benchmarking. |
| **Builder** | 🔨 | Ships features reliably | Regular, predictable commits. Follow patterns. Review-ready PRs. |
| **Debugger** | 🐛 | Finds root causes | Detailed root cause analysis. Regression tests. Add logging. |
| **Integrator** | 🔗 | Makes systems work together | API client libraries. Data contracts. Mock services. |
| **Mentor** | 👨‍🏫 | Teaches and guides | Educational comments. Constructive feedback. Style guides. |
| **Designer** | 🎨 | Creates beautiful interfaces | UI/UX focus. Accessibility. Design systems. |
| **Full-Stack Generalist** | 🌐 | Fills gaps anywhere | Broad knowledge. Cross-cutting features. Context-switching. |
| **Security-Minded** | 🔒 | Keeps systems safe | Vulnerability review. Threat models. Secure coding patterns. |
| **Performance Tuner** | ⚡ | Optimizes for speed | Profiling. Before/after metrics. Caching strategies. |
| **Toolsmith** | 🛠️ | Builds internal tools | Scripts and CLIs. Developer utilities. Automation. |

### Toggleable Skills

Mix and match skills to fine-tune behavior.

| Skill | Description | Behavior |
|-------|-------------|----------|
| **Concise** | Clear communication | Get to the point quickly while maintaining clarity |
| **Repo Hygiene** | Clean structures | Remove dead code, follow project conventions |
| **Organized** | Logical structure | Keep related changes together, clear separation of concerns |
| **Auto-Commit** | Incremental commits | Commit on feature changes, create branches to isolate work |
| **First Principles** | Fundamental reasoning | Understand "why" before "how" |
| **Auto-Compact** | Context management | Run `/compact` when context grows large |
| **Dependency-Aware** | Respect dependencies | Avoid unnecessary additions, keep versions aligned |
| **Graceful Degradation** | Error handling | Handle edge cases without catastrophic failure |
| **Scope Discipline** | Stay focused | Resist scope creep, ask before expanding work |
| **Doc Reflexes** | Auto documentation | Document non-obvious decisions and API changes |
| **Test-Driven** | Tests with code | Write/update tests alongside code changes |
| **Rollback Ready** | Reversible changes | Structure changes for easy rollback |

### Using Agent Configuration

1. Click the agent button in the toolbar
2. Select a persona from the dropdown
3. Toggle desired skills
4. Configuration persists per-conversation

### Toolbar Persona Indicator

A quick-access persona indicator appears in the toolbar between context usage and mode selector.

**Features:**

- Shows the currently active persona name (or "No persona" when none selected)
- Click to toggle inline suggestions widget
- Visual highlight when a persona is active

### Auto-Suggest Personas

Mysti can automatically suggest relevant personas based on your message content.

**How it works:**

1. Start typing your message
2. After a brief delay, Mysti analyzes your input
3. Relevant personas appear as chips above the input area
4. Click a chip to select that persona

**Settings:**

- Enabled by default (`mysti.agents.autoSuggest: true`)
- Toggle via the inline suggestions widget or settings

### Token Budget (Optional)

Control the maximum tokens used for agent context (personas + skills).

**Settings:**

- `mysti.agents.maxTokenBudget`: Maximum tokens (default: `0` = unlimited)
- When set to 0, no budget enforcement is applied
- When set to a value (e.g., 2000), agent context is limited to that token count
- If a persona exceeds the budget, a condensed version is used

**Recommended values:**

- 0 (unlimited) - Full persona/skill instructions
- 1000-2000 - Balanced context usage
- 500-1000 - Minimal context footprint

---

## Plan Selection

When the AI presents multiple implementation options, Mysti detects and displays them for selection.

### How Plan Detection Works

1. AI response contains implementation options/approaches
2. Mysti's ResponseClassifier analyzes the response
3. Detected plans are displayed as selectable cards
4. User selects preferred approach and execution mode

### Plan Card Information

Each plan card shows:
- **Title** - Name of the approach
- **Summary** - Brief description
- **Pros** - Advantages of this approach
- **Cons** - Trade-offs to consider
- **Complexity** - Low, Medium, or High

### Execution Modes

When selecting a plan, choose how to proceed:

| Mode | Description |
|------|-------------|
| **Ask Before Edit** | AI explains changes and waits for approval |
| **Edit Automatically** | AI makes changes directly |
| **Plan** | AI creates detailed plan without making changes |

---

## Permission System

Control what actions the AI can perform.

### Access Levels

| Level | Description |
|-------|-------------|
| **Read-only** | AI cannot modify any files |
| **Ask-permission** | AI requests approval for each action |
| **Full-access** | AI can perform all operations |

### Permission Requests

In `ask-permission` mode, the AI shows requests for:
- File creation
- File editing
- File deletion
- Bash commands
- Web requests

Each request includes:
- Action description
- Risk level (Low, Medium, High)
- Diff preview (for file changes)
- Approve/Deny buttons

### Timeout Behavior

Configure what happens when a permission request times out:

```json
{
  "mysti.permission.timeout": 30,
  "mysti.permission.timeoutBehavior": "auto-reject"
}
```

| Behavior | Description |
|----------|-------------|
| `auto-accept` | Automatically approve after timeout |
| `auto-reject` | Automatically deny after timeout |
| `require-action` | No timeout, require explicit action |

---

## Settings Reference

All Mysti settings with descriptions and defaults.

### Provider Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `mysti.defaultProvider` | `"claude-code"` | Default AI provider |
| `mysti.claudeCodePath` | `"claude"` | Path to Claude CLI |
| `mysti.codexPath` | `"codex"` | Path to Codex CLI |
| `mysti.defaultModel` | `"claude-sonnet-4-5-20250929"` | Default model |

### Operation Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `mysti.defaultMode` | `"ask-before-edit"` | Default operation mode |
| `mysti.defaultThinkingLevel` | `"medium"` | AI thinking level (none/low/medium/high) |
| `mysti.accessLevel` | `"ask-permission"` | File operation access level |
| `mysti.autoContext` | `true` | Auto-include relevant context |

### Brainstorm Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `mysti.brainstorm.enabled` | `false` | Enable brainstorm mode |
| `mysti.brainstorm.discussionMode` | `"quick"` | Discussion mode (quick/full) |
| `mysti.brainstorm.discussionRounds` | `1` | Rounds in full mode (1-3) |
| `mysti.brainstorm.synthesisAgent` | `"claude-code"` | Agent for synthesis |

### Agent Persona Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `mysti.agents.claudePersona` | `"neutral"` | Claude's persona in brainstorm |
| `mysti.agents.claudeCustomPrompt` | `""` | Custom prompt for Claude |
| `mysti.agents.codexPersona` | `"neutral"` | Codex's persona in brainstorm |
| `mysti.agents.codexCustomPrompt` | `""` | Custom prompt for Codex |
| `mysti.agents.autoSuggest` | `true` | Auto-suggest personas based on message content |
| `mysti.agents.maxTokenBudget` | `0` | Max tokens for agent context (0 = unlimited) |

### Permission Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `mysti.permission.timeout` | `30` | Seconds before timeout (0 = none) |
| `mysti.permission.timeoutBehavior` | `"auto-reject"` | Timeout behavior |
