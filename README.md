# Mysti - AI Coding Agent

<p align="center">
  <img src="resources/Mysti-Logo.png" alt="Mysti Logo" width="128" height="128">
</p>

<p align="center">
  <strong>A powerful AI coding agent for VSCode supporting multiple AI backends</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#documentation">Documentation</a>
</p>

---

## Overview

Mysti is a VSCode extension that provides an intelligent AI coding agent interface. It supports multiple AI providers (Claude Code CLI and OpenAI Codex CLI) and offers advanced features like multi-agent brainstorming, customizable personas, and fine-grained permission controls.

## Features

### Multi-Provider Support
- **Claude Code** - Anthropic's Claude with models like Sonnet 4.5 and Opus 4.5
- **OpenAI Codex** - OpenAI's code-focused models
- Seamless switching between providers

### Brainstorm Mode
Collaborate with multiple AI agents to solve complex problems:
- **Quick Mode** - Direct synthesis for faster results
- **Full Mode** - Agents review and discuss each other's responses (1-3 rounds)
- Configurable synthesis agent

### 16 Developer Personas
Customize AI behavior with specialized personas:

| Persona | Focus |
|---------|-------|
| Architect | System design, scalability, clean structure |
| Prototyper | Quick iteration, PoCs, experimentation |
| Product-Centric | User experience, feature delivery |
| Refactorer | Code quality, readability, maintainability |
| DevOps Engineer | CI/CD, automation, infrastructure |
| Domain Expert | Business logic, domain modeling |
| Researcher | Algorithms, ML, optimization |
| Builder | Reliable feature delivery |
| Debugger | Root cause analysis, bug fixing |
| Integrator | APIs, system connections |
| Mentor | Teaching, code reviews, guidance |
| Designer | UI/UX, accessibility, visual design |
| Full-Stack | Cross-cutting, end-to-end features |
| Security-Minded | Vulnerabilities, threat modeling |
| Performance Tuner | Optimization, profiling, latency |
| Toolsmith | Internal tools, automation, DX |

### 12 Toggleable Skills
Mix and match behavioral modifiers:
- **Concise** - Clear, brief communication
- **Repo Hygiene** - Clean file structures
- **Organized** - Logical structure
- **Auto-Commit** - Incremental commits
- **First Principles** - Fundamental reasoning
- **Auto-Compact** - Context management
- **Dependency-Aware** - Respect project deps
- **Graceful Degradation** - Error handling
- **Scope Discipline** - Stay focused
- **Doc Reflexes** - Auto documentation
- **Test-Driven** - Tests alongside code
- **Rollback Ready** - Reversible changes

### Plan Selection & Execution
- AI detects implementation options in responses
- Choose your preferred approach
- Select execution mode (ask-before-edit, edit-automatically, plan)

### Permission Management
- **Read-only** - No file modifications
- **Ask-permission** - Approve each action
- **Full-access** - All operations allowed
- Configurable timeouts and behaviors

### Additional Features
- Persistent conversation history
- Context-aware suggestions
- Code syntax highlighting with Prism.js
- Mermaid diagram support
- Theme-aware UI (light/dark)

## Installation

### From VSCode Marketplace
1. Open VSCode
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for "Mysti"
4. Click Install

### Manual Installation
```bash
# Clone the repository
git clone https://github.com/DeepMyst/Mysti.git
cd Mysti

# Install dependencies
npm install

# Build
npm run compile

# Package (optional)
npx vsce package
```

## Quick Start

1. **Install a CLI Provider**
   - [Claude Code CLI](https://docs.anthropic.com/claude/docs/claude-code) - `npm install -g @anthropic-ai/claude-code`
   - Or [OpenAI Codex CLI](https://platform.openai.com/docs/guides/code)

2. **Open Mysti**
   - Click the Mysti icon in the Activity Bar, or
   - Press `Ctrl+Shift+M` (`Cmd+Shift+M` on Mac)

3. **Start Chatting**
   - Type your question or request
   - Add context by right-clicking files in Explorer → "Add to Mysti Context"

4. **Configure Your Agent**
   - Click the agent button to select a persona
   - Toggle skills for customized behavior

## Keyboard Shortcuts

| Action | Windows/Linux | Mac |
|--------|---------------|-----|
| Open Mysti Chat | `Ctrl+Shift+M` | `Cmd+Shift+M` |
| Open in New Tab | `Ctrl+Shift+N` | `Cmd+Shift+N` |

## Configuration

Access settings via `File > Preferences > Settings` and search for "Mysti".

### Provider Settings
```json
{
  "mysti.defaultProvider": "claude-code",
  "mysti.claudeCodePath": "claude",
  "mysti.codexPath": "codex",
  "mysti.defaultModel": "claude-sonnet-4-5-20250929"
}
```

### Operation Mode
```json
{
  "mysti.defaultMode": "ask-before-edit",
  "mysti.defaultThinkingLevel": "medium",
  "mysti.accessLevel": "ask-permission"
}
```

### Brainstorm Settings
```json
{
  "mysti.brainstorm.enabled": false,
  "mysti.brainstorm.discussionMode": "quick",
  "mysti.brainstorm.discussionRounds": 1,
  "mysti.brainstorm.synthesisAgent": "claude-code"
}
```

### Permission Settings
```json
{
  "mysti.permission.timeout": 30,
  "mysti.permission.timeoutBehavior": "auto-reject"
}
```

## Requirements

- VSCode 1.85.0 or higher
- One of the following CLI tools:
  - **Claude Code CLI** - Install via `npm install -g @anthropic-ai/claude-code`
  - **OpenAI Codex CLI** - Install via OpenAI's instructions

## Telemetry

Mysti collects anonymous usage data to improve the extension. This includes:

- Feature usage (which personas/skills are popular)
- Error rates and types
- Provider/model preferences

**No personal data, code, or file paths are ever collected.**

Telemetry respects VSCode's global setting. To disable:

1. Open Settings (`Ctrl+,` / `Cmd+,`)
2. Search for "telemetry"
3. Set `Telemetry: Telemetry Level` to "off"

## Documentation

- [Features Guide](docs/FEATURES.md) - Detailed feature documentation
- [Architecture](docs/ARCHITECTURE.md) - Technical documentation for contributors
- [CLAUDE.md](CLAUDE.md) - Development guidance

## Commands

| Command | Description |
|---------|-------------|
| `Mysti: Open Mysti Chat` | Open the chat sidebar |
| `Mysti: New Conversation` | Start a new conversation |
| `Mysti: Add to Mysti Context` | Add file/selection to context |
| `Mysti: Clear Context` | Clear all context items |
| `Mysti: Open Mysti in New Tab` | Open chat in editor tab |

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the **Business Source License 1.1 (BSL 1.1)**.

- **Non-commercial use**: Free for personal, educational, and non-profit use
- **Commercial use**: Requires a separate commercial license
- **Change Date**: December 3, 2030 (converts to MIT License)

See the [LICENSE](LICENSE) file for full details.

For commercial licensing inquiries, please contact baha@deepmyst.com.

---

## Credits

**Mysti** is developed and maintained by [DeepMyst Inc](https://deepmyst.com).

- **Author:** Baha Abunojaim
- **Email:** baha@deepmyst.com
- **GitHub:** [DeepMyst/Mysti](https://github.com/DeepMyst/Mysti)

---

<p align="center">
  Made with Claude Code by DeepMyst Inc
</p>
