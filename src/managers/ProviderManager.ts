import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type {
  ContextItem,
  Settings,
  Conversation,
  StreamChunk,
  ProviderConfig,
  ModelInfo
} from '../types';

export class ProviderManager {
  private _extensionContext: vscode.ExtensionContext;
  private _currentProcess: ChildProcess | null = null;
  private _providers: Map<string, ProviderConfig> = new Map();
  private _currentSessionId: string | null = null;

  // Tool call state tracking
  private _activeToolCalls: Map<number, { id: string; name: string; inputJson: string }> = new Map();

  constructor(context: vscode.ExtensionContext) {
    this._extensionContext = context;
    this._initializeProviders();
  }

  // Session management methods
  public clearSession() {
    console.log('[Mysti] Clearing session:', this._currentSessionId);
    this._currentSessionId = null;
  }

  public hasSession(): boolean {
    return this._currentSessionId !== null;
  }

  public getSessionId(): string | null {
    return this._currentSessionId;
  }

  private _findClaudeCliPath(): string {
    const config = vscode.workspace.getConfiguration('mysti');
    const configuredPath = config.get<string>('claudeCodePath', 'claude');

    // If user has configured a custom path, try it first
    if (configuredPath !== 'claude') {
      return configuredPath;
    }

    // Try to find Claude CLI in VS Code extensions directory
    const homeDir = os.homedir();
    const extensionsDir = path.join(homeDir, '.vscode', 'extensions');

    try {
      if (fs.existsSync(extensionsDir)) {
        const entries = fs.readdirSync(extensionsDir);
        // Find the latest Claude Code extension
        const claudeExtensions = entries
          .filter(e => e.startsWith('anthropic.claude-code-'))
          .sort()
          .reverse();

        for (const ext of claudeExtensions) {
          const binaryPath = path.join(extensionsDir, ext, 'resources', 'native-binary', 'claude');
          if (fs.existsSync(binaryPath)) {
            console.log('[Mysti] Found Claude CLI at:', binaryPath);
            return binaryPath;
          }
        }
      }
    } catch (error) {
      console.error('[Mysti] Error searching for Claude CLI:', error);
    }

    // Fallback to default
    return configuredPath;
  }

  private _initializeProviders() {
    // Claude Code CLI provider
    this._providers.set('claude-code', {
      name: 'claude-code',
      displayName: 'Claude Code',
      models: [
        {
          id: 'claude-sonnet-4-5-20250929',
          name: 'Claude Sonnet 4.5',
          description: 'Most capable model, best for complex tasks',
          contextWindow: 200000
        },
        {
          id: 'claude-opus-4-5-20251101',
          name: 'Claude Opus 4.5',
          description: 'Advanced reasoning and analysis',
          contextWindow: 200000
        },
        {
          id: 'claude-3-5-haiku-20241022',
          name: 'Claude 3.5 Haiku',
          description: 'Fast and efficient for simpler tasks',
          contextWindow: 200000
        }
      ],
      defaultModel: 'claude-sonnet-4-5-20250929'
    });
  }

  public getProviders(): ProviderConfig[] {
    return Array.from(this._providers.values());
  }

  public getProvider(name: string): ProviderConfig | undefined {
    return this._providers.get(name);
  }

  public getModels(providerName: string): ModelInfo[] {
    const provider = this._providers.get(providerName);
    return provider ? provider.models : [];
  }

  public async *sendMessage(
    content: string,
    context: ContextItem[],
    settings: Settings,
    conversation: Conversation | null
  ): AsyncGenerator<StreamChunk> {
    const provider = settings.provider || 'claude-code';

    switch (provider) {
      case 'claude-code':
        yield* this._sendClaudeCodeMessage(content, context, settings, conversation);
        break;
      default:
        yield { type: 'error', content: `Unknown provider: ${provider}` };
    }
  }

  private async *_sendClaudeCodeMessage(
    content: string,
    context: ContextItem[],
    settings: Settings,
    conversation: Conversation | null
  ): AsyncGenerator<StreamChunk> {
    const claudePath = this._findClaudeCliPath();

    // Build the command arguments (following ezorro-agent-v2 pattern exactly)
    const args: string[] = [
      '--output-format', 'stream-json',       // Structured JSON output
      '--include-partial-messages',           // CRITICAL: Enable streaming chunks
      '--verbose',                            // Required for stream-json to work
      '--dangerously-skip-permissions',       // Skip interactive permission prompts
      '--permission-mode', 'bypassPermissions', // Bypass all permission checks
    ];

    // Session handling: resume existing or start new
    if (this._currentSessionId) {
      args.push('--resume', this._currentSessionId);
      console.log('[Mysti] Resuming session:', this._currentSessionId);
    } else {
      args.push('--print');  // Stateless mode for new requests
      console.log('[Mysti] Starting new session');
    }

    // Add model selection
    if (settings.model) {
      args.push('--model', settings.model);
    }

    // Build the full prompt with context
    let fullPrompt = '';

    // Add context if present
    if (context.length > 0) {
      fullPrompt += this._formatContext(context);
      fullPrompt += '\n\n';
    }

    // Add conversation history
    if (conversation && conversation.messages.length > 0) {
      fullPrompt += this._formatConversationHistory(conversation);
      fullPrompt += '\n\n';
    }

    // Add the current message
    fullPrompt += content;

    // Add mode-specific instructions
    fullPrompt = this._addModeInstructions(fullPrompt, settings.mode);

    try {
      // Get workspace folder for CWD
      const workspaceFolders = vscode.workspace.workspaceFolders;
      const cwd = workspaceFolders ? workspaceFolders[0].uri.fsPath : process.cwd();

      console.log('[Mysti] Starting Claude CLI with args:', args);
      console.log('[Mysti] Working directory:', cwd);

      // Spawn the process WITHOUT shell: true to avoid shell interpretation issues
      // The prompt will be sent via stdin, not as a command argument
      this._currentProcess = spawn(claudePath, args, {
        cwd,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe']  // stdin, stdout, stderr all piped
      });

      // Collect stderr for error reporting
      let stderrOutput = '';
      if (this._currentProcess.stderr) {
        this._currentProcess.stderr.on('data', (data) => {
          const text = data.toString();
          stderrOutput += text;
          console.log('[Mysti] stderr:', text);
        });
      }

      // Send the prompt via stdin (like ezorro-agent-v2 does)
      if (this._currentProcess.stdin) {
        this._currentProcess.stdin.write(fullPrompt);
        this._currentProcess.stdin.end();
      }

      let buffer = '';
      let hasYieldedContent = false;

      if (this._currentProcess.stdout) {
        for await (const chunk of this._currentProcess.stdout) {
          const chunkStr = chunk.toString();
          console.log('[Mysti] stdout chunk:', chunkStr.substring(0, 200));
          buffer += chunkStr;

          // Process complete JSON lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.trim()) {
              console.log('[Mysti] Processing line:', line.substring(0, 100));
              const parsed = this._parseStreamLine(line);
              if (parsed) {
                console.log('[Mysti] Parsed result:', parsed.type);
                hasYieldedContent = true;
                yield parsed;
              }
            }
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        const parsed = this._parseStreamLine(buffer);
        if (parsed) {
          hasYieldedContent = true;
          yield parsed;
        }
      }

      // Wait for process to complete
      const exitCode = await new Promise<number | null>((resolve, reject) => {
        if (!this._currentProcess) {
          resolve(null);
          return;
        }

        this._currentProcess.on('close', (code) => {
          console.log('[Mysti] Process closed with code:', code);
          resolve(code);
        });

        this._currentProcess.on('error', (err) => {
          console.error('[Mysti] Process error:', err);
          reject(err);
        });
      });

      // If we got an error exit code and no content, yield the stderr as error
      if (exitCode !== 0 && exitCode !== null && !hasYieldedContent && stderrOutput) {
        yield { type: 'error', content: stderrOutput };
      } else if (!hasYieldedContent && stderrOutput) {
        // Also show stderr if no content was yielded
        yield { type: 'error', content: `No response received. stderr: ${stderrOutput}` };
      }

      yield { type: 'done' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to execute Claude Code CLI';
      console.error('[Mysti] Catch block error:', errorMessage);

      // Check if Claude CLI is not found
      if (errorMessage.includes('ENOENT') || errorMessage.includes('not found')) {
        yield {
          type: 'error',
          content: `Claude Code CLI not found. Please install it first:\n\nnpm install -g @anthropic-ai/claude-code\n\nOr configure the path in settings: mysti.claudeCodePath`
        };
      } else {
        yield {
          type: 'error',
          content: errorMessage
        };
      }
    } finally {
      this._currentProcess = null;
    }
  }

  private _parseStreamLine(line: string): StreamChunk | null {
    try {
      const data = JSON.parse(line);

      // Handle stream_event wrapper (ezorro-agent-v2 pattern)
      // Claude CLI wraps events: {"type": "stream_event", "event": {...}}
      if (data.type === 'stream_event') {
        const nestedEvent = data.event || {};
        const nestedType = nestedEvent.type || '';
        const blockIndex = nestedEvent.index ?? -1;

        // Handle content_block_delta - the main streaming content
        if (nestedType === 'content_block_delta') {
          const delta = nestedEvent.delta || {};
          if (delta.type === 'text_delta') {
            return { type: 'text', content: delta.text || '' };
          }
          if (delta.type === 'thinking_delta') {
            return { type: 'thinking', content: delta.thinking || '' };
          }
          if (delta.type === 'input_json_delta') {
            // Accumulate tool input JSON
            const activeTool = this._activeToolCalls.get(blockIndex);
            if (activeTool) {
              activeTool.inputJson += delta.partial_json || '';
            }
            return null;
          }
        }

        // Handle content_block_start - beginning of a content block
        if (nestedType === 'content_block_start') {
          const contentBlock = nestedEvent.content_block || {};
          if (contentBlock.type === 'tool_use') {
            // Store tool call info for accumulation
            this._activeToolCalls.set(blockIndex, {
              id: contentBlock.id || '',
              name: contentBlock.name || '',
              inputJson: ''
            });
            // Return tool_use immediately with running status
            return {
              type: 'tool_use',
              toolCall: {
                id: contentBlock.id || '',
                name: contentBlock.name || '',
                input: {},
                status: 'running'
              }
            };
          }
          if (contentBlock.type === 'thinking') {
            return { type: 'thinking', content: '' };
          }
        }

        // Handle content_block_stop - end of a content block
        if (nestedType === 'content_block_stop') {
          // Check if this was a tool block and emit with complete input
          const completedTool = this._activeToolCalls.get(blockIndex);
          if (completedTool) {
            this._activeToolCalls.delete(blockIndex);
            // Parse the accumulated JSON
            let parsedInput = {};
            try {
              if (completedTool.inputJson) {
                parsedInput = JSON.parse(completedTool.inputJson);
              }
            } catch {
              console.log('[Mysti] Failed to parse tool input JSON:', completedTool.inputJson);
            }
            // Emit tool_use with complete input (UI will update the existing element)
            return {
              type: 'tool_use',
              toolCall: {
                id: completedTool.id,
                name: completedTool.name,
                input: parsedInput,
                status: 'running'
              }
            };
          }
          return null;
        }

        // Handle message lifecycle events
        if (nestedType === 'message_start' || nestedType === 'message_delta' || nestedType === 'message_stop') {
          return null;
        }

        return null;
      }

      // Handle direct result event (final message)
      if (data.type === 'result') {
        if (data.result) {
          return { type: 'text', content: data.result };
        }
        return null;
      }

      // Handle system events (session init, etc.)
      if (data.type === 'system') {
        // Extract session ID from init event
        if (data.subtype === 'init') {
          const sessionId = data.session_id || data.sessionId;
          if (sessionId && !this._currentSessionId) {
            this._currentSessionId = sessionId;
            console.log('[Mysti] Session ID extracted:', sessionId);
            return { type: 'session_active', sessionId };
          }
        }
        return null;
      }

      // Handle assistant complete message - extract tool results
      if (data.type === 'assistant') {
        // Check for tool use in the content array
        if (data.message?.content) {
          for (const block of data.message.content) {
            if (block.type === 'tool_use') {
              // This is a complete tool_use block, we can use it for input
              return {
                type: 'tool_use',
                toolCall: {
                  id: block.id || '',
                  name: block.name || '',
                  input: block.input || {},
                  status: 'running'
                }
              };
            }
          }
        }
        return null;
      }

      // Handle error events
      if (data.type === 'error') {
        return {
          type: 'error',
          content: data.error?.message || data.message || 'Unknown error'
        };
      }

      // Handle tool_result events (user message containing tool results)
      if (data.type === 'user' && data.message?.content) {
        for (const block of data.message.content) {
          if (block.type === 'tool_result') {
            return {
              type: 'tool_result',
              toolCall: {
                id: block.tool_use_id || '',
                name: '',
                input: {},
                output: typeof block.content === 'string' ? block.content : JSON.stringify(block.content),
                status: block.is_error ? 'failed' : 'completed'
              }
            };
          }
        }
      }

      // Handle direct tool_result events
      if (data.type === 'tool_result') {
        return {
          type: 'tool_result',
          toolCall: {
            id: data.tool_use_id || data.tool_id || '',
            name: data.tool_name || '',
            input: {},
            output: typeof data.content === 'string' ? data.content : JSON.stringify(data.content || ''),
            status: data.is_error ? 'failed' : 'completed'
          }
        };
      }

    } catch {
      // If it's not JSON, treat as plain text
      if (line.trim()) {
        return { type: 'text', content: line };
      }
    }

    return null;
  }

  public cancelCurrentRequest() {
    if (this._currentProcess) {
      this._currentProcess.kill('SIGTERM');
      this._currentProcess = null;
    }
  }

  public async enhancePrompt(prompt: string): Promise<string> {
    const claudePath = this._findClaudeCliPath();

    const enhancePrompt = `Please enhance the following prompt to be more specific and effective for a coding assistant. Return only the enhanced prompt without any explanation:

Original prompt: "${prompt}"

Enhanced prompt:`;

    return new Promise((resolve) => {
      const args = ['--print', '--output-format', 'text'];

      const proc = spawn(claudePath, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';

      // Send prompt via stdin
      if (proc.stdin) {
        proc.stdin.write(enhancePrompt);
        proc.stdin.end();
      }

      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0 && output.trim()) {
          resolve(output.trim());
        } else {
          resolve(prompt); // Return original on error
        }
      });

      proc.on('error', () => {
        resolve(prompt); // Return original on error
      });
    });
  }

  private _formatContext(context: ContextItem[]): string {
    let formatted = '# Context Files\n\n';

    for (const item of context) {
      if (item.type === 'file') {
        formatted += `## ${item.path}\n`;
        formatted += `\`\`\`${item.language || ''}\n${item.content}\n\`\`\`\n\n`;
      } else if (item.type === 'selection') {
        formatted += `## Selection from ${item.path} (lines ${item.startLine}-${item.endLine})\n`;
        formatted += `\`\`\`${item.language || ''}\n${item.content}\n\`\`\`\n\n`;
      }
    }

    return formatted;
  }

  private _formatConversationHistory(conversation: Conversation): string {
    let formatted = '# Previous Conversation\n\n';

    for (const message of conversation.messages.slice(-10)) { // Last 10 messages
      const role = message.role === 'user' ? 'User' : 'Assistant';
      formatted += `**${role}:** ${message.content}\n\n`;
    }

    return formatted;
  }

  private _addModeInstructions(prompt: string, mode: string): string {
    const modeInstructions: Record<string, string> = {
      'ask-before-edit': '\n\n[Mode: Ask before making any edits. Explain what changes you want to make and wait for approval before modifying any files.]',
      'edit-automatically': '\n\n[Mode: You may edit files directly without asking for permission.]',
      'plan': '\n\n[Mode: Planning mode. Create a detailed plan for the task without making any actual changes. Break down the work into steps.]',
      'brainstorm': '\n\n[Mode: Brainstorming mode. Explore ideas and possibilities without committing to any specific implementation.]'
    };

    return prompt + (modeInstructions[mode] || '');
  }
}
