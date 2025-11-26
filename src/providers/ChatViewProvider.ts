import * as vscode from 'vscode';
import * as fs from 'fs';
import { ContextManager } from '../managers/ContextManager';
import { ConversationManager } from '../managers/ConversationManager';
import { ProviderManager } from '../managers/ProviderManager';
import { getWebviewContent } from '../webview/webviewContent';
import type { WebviewMessage, Settings, ContextItem } from '../types';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _extensionUri: vscode.Uri;
  private _contextManager: ContextManager;
  private _conversationManager: ConversationManager;
  private _providerManager: ProviderManager;

  constructor(
    extensionUri: vscode.Uri,
    contextManager: ContextManager,
    conversationManager: ConversationManager,
    providerManager: ProviderManager
  ) {
    this._extensionUri = extensionUri;
    this._contextManager = contextManager;
    this._conversationManager = conversationManager;
    this._providerManager = providerManager;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = getWebviewContent(webviewView.webview, this._extensionUri);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      await this._handleMessage(message);
    });

    // Send initial state
    this._sendInitialState();
  }

  private async _sendInitialState() {
    const config = vscode.workspace.getConfiguration('mysti');
    const settings: Settings = {
      mode: config.get('defaultMode', 'ask-before-edit'),
      thinkingLevel: config.get('defaultThinkingLevel', 'medium'),
      accessLevel: config.get('accessLevel', 'ask-permission'),
      contextMode: config.get('autoContext', true) ? 'auto' : 'manual',
      model: config.get('defaultModel', 'claude-sonnet-4-5-20250929'),
      provider: config.get('defaultProvider', 'claude-code')
    };

    this.postMessage({
      type: 'initialState',
      payload: {
        settings,
        context: this._contextManager.getContext(),
        conversation: this._conversationManager.getCurrentConversation(),
        providers: this._providerManager.getProviders(),
        slashCommands: this._getSlashCommands(),
        quickActions: this._getQuickActions()
      }
    });
  }

  private async _handleMessage(message: WebviewMessage) {
    switch (message.type) {
      case 'sendMessage':
        await this._handleSendMessage(message.payload as {
          content: string;
          context: ContextItem[];
          settings: Settings;
        });
        break;

      case 'cancelRequest':
        this._providerManager.cancelCurrentRequest();
        break;

      case 'updateSettings':
        await this._handleUpdateSettings(message.payload as Partial<Settings>);
        break;

      case 'addToContext':
        await this._handleAddToContext(message.payload as { path: string; type: string });
        break;

      case 'removeFromContext':
        this._contextManager.removeFromContext(message.payload as string);
        this.postMessage({
          type: 'contextUpdated',
          payload: this._contextManager.getContext()
        });
        break;

      case 'clearContext':
        this._contextManager.clearContext();
        this.postMessage({
          type: 'contextUpdated',
          payload: []
        });
        break;

      case 'executeSlashCommand':
        await this._handleSlashCommand(message.payload as { command: string; args: string });
        break;

      case 'executeQuickAction':
        await this._handleQuickAction(message.payload as string);
        break;

      case 'enhancePrompt':
        await this._handleEnhancePrompt(message.payload as string);
        break;

      case 'newConversation':
        this._providerManager.clearSession();  // Clear Claude session
        this._conversationManager.createNewConversation();
        this.postMessage({
          type: 'conversationChanged',
          payload: this._conversationManager.getCurrentConversation()
        });
        this.postMessage({
          type: 'sessionCleared',
          payload: { message: 'Session cleared' }
        });
        break;

      case 'clearSession':
        this._providerManager.clearSession();
        this.postMessage({
          type: 'sessionCleared',
          payload: { message: 'Session cleared' }
        });
        break;

      case 'requestPermission':
        await this._handlePermissionRequest(message.payload as {
          action: string;
          details: string;
        });
        break;

      case 'openFile':
        await this._handleOpenFile(message.payload as { path: string; line?: number });
        break;

      case 'applyEdit':
        await this._handleApplyEdit(message.payload as {
          path: string;
          content: string;
          startLine?: number;
          endLine?: number;
        });
        break;

      case 'getWorkspaceFiles':
        await this._handleGetWorkspaceFiles();
        break;

      case 'copyToClipboard':
        await vscode.env.clipboard.writeText(message.payload as string);
        break;

      case 'revertFileEdit':
        await this._handleRevertFileEdit(message.payload as { path: string });
        break;

      case 'getFileLineNumber':
        await this._handleGetFileLineNumber(message.payload as { filePath: string; searchText: string });
        break;
    }
  }

  private async _handleGetFileLineNumber(payload: { filePath: string; searchText: string }) {
    try {
      const content = await fs.promises.readFile(payload.filePath, 'utf-8');
      let lineNumber = 1;
      const searchIndex = content.indexOf(payload.searchText);
      if (searchIndex !== -1) {
        // Count newlines before the match to get line number
        for (let i = 0; i < searchIndex; i++) {
          if (content[i] === '\n') lineNumber++;
        }
      }
      this.postMessage({
        type: 'fileLineNumber',
        payload: { filePath: payload.filePath, lineNumber }
      });
    } catch {
      // If file can't be read, return line 1 as default
      this.postMessage({
        type: 'fileLineNumber',
        payload: { filePath: payload.filePath, lineNumber: 1 }
      });
    }
  }

  private async _handleRevertFileEdit(payload: { path: string }) {
    try {
      const uri = vscode.Uri.file(payload.path);

      // Try to use git to revert the file
      try {
        await vscode.commands.executeCommand('git.clean', uri);
      } catch {
        // If git clean fails, try checkout
        await vscode.commands.executeCommand('git.checkout', uri);
      }

      this.postMessage({
        type: 'fileReverted',
        payload: { path: payload.path, success: true }
      });

      vscode.window.showInformationMessage(`Reverted changes to ${payload.path}`);
    } catch (error) {
      this.postMessage({
        type: 'fileReverted',
        payload: {
          path: payload.path,
          success: false,
          error: error instanceof Error ? error.message : 'Failed to revert'
        }
      });

      vscode.window.showErrorMessage(`Failed to revert ${payload.path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async _handleSendMessage(payload: {
    content: string;
    context: ContextItem[];
    settings: Settings;
  }) {
    const { content, context, settings } = payload;

    // Add user message to conversation
    const userMessage = this._conversationManager.addMessage('user', content, context);
    this.postMessage({
      type: 'messageAdded',
      payload: userMessage
    });

    // Stream response from provider
    try {
      this.postMessage({ type: 'responseStarted' });

      const stream = this._providerManager.sendMessage(
        content,
        context,
        settings,
        this._conversationManager.getCurrentConversation()
      );

      let assistantContent = '';
      let thinkingContent = '';

      for await (const chunk of stream) {
        switch (chunk.type) {
          case 'text':
            assistantContent += chunk.content || '';
            this.postMessage({
              type: 'responseChunk',
              payload: { type: 'text', content: chunk.content }
            });
            break;

          case 'thinking':
            thinkingContent += chunk.content || '';
            this.postMessage({
              type: 'responseChunk',
              payload: { type: 'thinking', content: chunk.content }
            });
            break;

          case 'tool_use':
            this.postMessage({
              type: 'toolUse',
              payload: chunk.toolCall
            });
            break;

          case 'tool_result':
            this.postMessage({
              type: 'toolResult',
              payload: chunk.toolCall
            });
            break;

          case 'error':
            this.postMessage({
              type: 'error',
              payload: chunk.content
            });
            break;

          case 'session_active':
            this.postMessage({
              type: 'sessionActive',
              payload: { sessionId: chunk.sessionId }
            });
            break;

          case 'done':
            const assistantMessage = this._conversationManager.addMessage(
              'assistant',
              assistantContent,
              undefined,
              thinkingContent
            );
            this.postMessage({
              type: 'responseComplete',
              payload: assistantMessage
            });
            break;
        }
      }
    } catch (error) {
      this.postMessage({
        type: 'error',
        payload: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    }
  }

  private async _handleUpdateSettings(settings: Partial<Settings>) {
    const config = vscode.workspace.getConfiguration('mysti');

    if (settings.mode !== undefined) {
      await config.update('defaultMode', settings.mode, vscode.ConfigurationTarget.Global);
    }
    if (settings.thinkingLevel !== undefined) {
      await config.update('defaultThinkingLevel', settings.thinkingLevel, vscode.ConfigurationTarget.Global);
    }
    if (settings.accessLevel !== undefined) {
      await config.update('accessLevel', settings.accessLevel, vscode.ConfigurationTarget.Global);
    }
    if (settings.contextMode !== undefined) {
      await config.update('autoContext', settings.contextMode === 'auto', vscode.ConfigurationTarget.Global);
      this._contextManager.setAutoContext(settings.contextMode === 'auto');
    }
    if (settings.model !== undefined) {
      await config.update('defaultModel', settings.model, vscode.ConfigurationTarget.Global);
    }
    if (settings.provider !== undefined) {
      await config.update('defaultProvider', settings.provider, vscode.ConfigurationTarget.Global);
    }
  }

  private async _handleAddToContext(payload: { path: string; type: string }) {
    if (payload.type === 'file') {
      await this._contextManager.addFileToContext(payload.path);
    } else if (payload.type === 'folder') {
      await this._contextManager.addFolderToContext(payload.path);
    }
    this.postMessage({
      type: 'contextUpdated',
      payload: this._contextManager.getContext()
    });
  }

  private async _handleSlashCommand(payload: { command: string; args: string }) {
    const commands = this._getSlashCommands();
    const cmd = commands.find(c => c.name === payload.command);
    if (cmd) {
      const result = cmd.handler(payload.args);
      this.postMessage({
        type: 'slashCommandResult',
        payload: { command: payload.command, result }
      });
    }
  }

  private async _handleQuickAction(actionId: string) {
    const actions = this._getQuickActions();
    const action = actions.find(a => a.id === actionId);
    if (action) {
      this.postMessage({
        type: 'insertPrompt',
        payload: action.prompt
      });
    }
  }

  private async _handleEnhancePrompt(prompt: string) {
    // Send to AI to enhance the prompt
    const enhancedPrompt = await this._providerManager.enhancePrompt(prompt);
    this.postMessage({
      type: 'promptEnhanced',
      payload: enhancedPrompt
    });
  }

  private async _handlePermissionRequest(payload: { action: string; details: string }) {
    const result = await vscode.window.showInformationMessage(
      `Mysti wants to ${payload.action}: ${payload.details}`,
      { modal: true },
      'Allow',
      'Deny'
    );
    this.postMessage({
      type: 'permissionResult',
      payload: { action: payload.action, allowed: result === 'Allow' }
    });
  }

  private async _handleOpenFile(payload: { path: string; line?: number }) {
    const uri = vscode.Uri.file(payload.path);
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document);
    if (payload.line !== undefined) {
      const position = new vscode.Position(payload.line, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position));
    }
  }

  private async _handleApplyEdit(payload: {
    path: string;
    content: string;
    startLine?: number;
    endLine?: number;
  }) {
    const uri = vscode.Uri.file(payload.path);
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document);

    const edit = new vscode.WorkspaceEdit();
    if (payload.startLine !== undefined && payload.endLine !== undefined) {
      const range = new vscode.Range(
        new vscode.Position(payload.startLine, 0),
        new vscode.Position(payload.endLine, document.lineAt(payload.endLine).text.length)
      );
      edit.replace(uri, range, payload.content);
    } else {
      const fullRange = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length)
      );
      edit.replace(uri, fullRange, payload.content);
    }

    await vscode.workspace.applyEdit(edit);
    this.postMessage({
      type: 'editApplied',
      payload: { path: payload.path, success: true }
    });
  }

  private async _handleGetWorkspaceFiles() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      this.postMessage({
        type: 'workspaceFiles',
        payload: []
      });
      return;
    }

    const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**', 1000);
    this.postMessage({
      type: 'workspaceFiles',
      payload: files.map(f => f.fsPath)
    });
  }

  private _getSlashCommands() {
    return [
      {
        name: 'clear',
        description: 'Clear the conversation',
        handler: () => {
          this._providerManager.clearSession();
          this._conversationManager.createNewConversation();
          this.postMessage({
            type: 'sessionCleared',
            payload: { message: 'Session cleared' }
          });
          return 'Conversation and session cleared';
        }
      },
      {
        name: 'help',
        description: 'Show available commands',
        handler: () => {
          return 'Available commands: /clear, /help, /context, /mode, /model';
        }
      },
      {
        name: 'context',
        description: 'Show current context',
        handler: () => {
          const context = this._contextManager.getContext();
          return context.length > 0
            ? `Current context:\n${context.map(c => `- ${c.path}`).join('\n')}`
            : 'No context items added';
        }
      },
      {
        name: 'mode',
        description: 'Show or change operation mode',
        handler: (args: string) => {
          if (args) {
            const modes = ['ask-before-edit', 'edit-automatically', 'plan', 'brainstorm'];
            if (modes.includes(args)) {
              this._handleUpdateSettings({ mode: args as any });
              return `Mode changed to: ${args}`;
            }
            return `Invalid mode. Available modes: ${modes.join(', ')}`;
          }
          const config = vscode.workspace.getConfiguration('mysti');
          return `Current mode: ${config.get('defaultMode')}`;
        }
      },
      {
        name: 'model',
        description: 'Show or change model',
        handler: (args: string) => {
          if (args) {
            this._handleUpdateSettings({ model: args });
            return `Model changed to: ${args}`;
          }
          const config = vscode.workspace.getConfiguration('mysti');
          return `Current model: ${config.get('defaultModel')}`;
        }
      }
    ];
  }

  private _getQuickActions() {
    return [
      {
        id: 'explain',
        label: 'Explain this code',
        prompt: 'Explain the selected code in detail',
        icon: 'info'
      },
      {
        id: 'refactor',
        label: 'Refactor',
        prompt: 'Suggest refactoring improvements for this code',
        icon: 'wrench'
      },
      {
        id: 'fix-bugs',
        label: 'Find bugs',
        prompt: 'Find potential bugs in this code',
        icon: 'bug'
      },
      {
        id: 'add-tests',
        label: 'Add tests',
        prompt: 'Generate unit tests for this code',
        icon: 'beaker'
      },
      {
        id: 'optimize',
        label: 'Optimize',
        prompt: 'Suggest performance optimizations',
        icon: 'zap'
      },
      {
        id: 'document',
        label: 'Add docs',
        prompt: 'Add documentation and comments to this code',
        icon: 'book'
      }
    ];
  }

  public postMessage(message: WebviewMessage) {
    this._view?.webview.postMessage(message);
  }
}
