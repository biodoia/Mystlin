import * as vscode from 'vscode';
import type { Conversation, Message, ContextItem, OperationMode, ProviderType } from '../types';

export class ConversationManager {
  private _conversations: Map<string, Conversation> = new Map();
  private _currentConversationId: string | null = null;
  private _extensionContext: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this._extensionContext = context;
    this._loadConversations();

    // Create initial conversation if none exists
    if (this._conversations.size === 0) {
      this.createNewConversation();
    }
  }

  public getCurrentConversation(): Conversation | null {
    if (!this._currentConversationId) {
      return null;
    }
    return this._conversations.get(this._currentConversationId) || null;
  }

  public getConversation(id: string): Conversation | null {
    return this._conversations.get(id) || null;
  }

  public getAllConversations(): Conversation[] {
    return Array.from(this._conversations.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public createNewConversation(): Conversation {
    const config = vscode.workspace.getConfiguration('mysti');

    const conversation: Conversation = {
      id: this._generateId(),
      title: 'New Conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      mode: config.get('defaultMode', 'ask-before-edit') as OperationMode,
      model: config.get('defaultModel', 'claude-sonnet-4-5-20250929'),
      provider: config.get('defaultProvider', 'claude-code') as ProviderType
    };

    this._conversations.set(conversation.id, conversation);
    this._currentConversationId = conversation.id;
    this._saveConversations();

    return conversation;
  }

  public switchConversation(id: string): boolean {
    if (this._conversations.has(id)) {
      this._currentConversationId = id;
      return true;
    }
    return false;
  }

  public deleteConversation(id: string): boolean {
    if (this._conversations.has(id)) {
      this._conversations.delete(id);

      // If we deleted the current conversation, switch to another or create new
      if (this._currentConversationId === id) {
        const remaining = Array.from(this._conversations.keys());
        if (remaining.length > 0) {
          this._currentConversationId = remaining[0];
        } else {
          this.createNewConversation();
        }
      }

      this._saveConversations();
      return true;
    }
    return false;
  }

  public addMessage(
    role: 'user' | 'assistant' | 'system',
    content: string,
    context?: ContextItem[],
    thinking?: string
  ): Message {
    const conversation = this.getCurrentConversation();
    if (!conversation) {
      throw new Error('No active conversation');
    }

    const message: Message = {
      id: this._generateId(),
      role,
      content,
      timestamp: Date.now(),
      context,
      thinking
    };

    conversation.messages.push(message);
    conversation.updatedAt = Date.now();

    // Auto-generate title from first user message
    if (role === 'user' && conversation.messages.filter(m => m.role === 'user').length === 1) {
      conversation.title = this._generateTitle(content);
    }

    this._saveConversations();
    return message;
  }

  public updateMessage(messageId: string, updates: Partial<Message>): boolean {
    const conversation = this.getCurrentConversation();
    if (!conversation) {
      return false;
    }

    const message = conversation.messages.find(m => m.id === messageId);
    if (message) {
      Object.assign(message, updates);
      conversation.updatedAt = Date.now();
      this._saveConversations();
      return true;
    }
    return false;
  }

  public getMessages(): Message[] {
    const conversation = this.getCurrentConversation();
    return conversation ? conversation.messages : [];
  }

  public clearMessages() {
    const conversation = this.getCurrentConversation();
    if (conversation) {
      conversation.messages = [];
      conversation.updatedAt = Date.now();
      this._saveConversations();
    }
  }

  public updateConversationSettings(settings: {
    mode?: OperationMode;
    model?: string;
    provider?: ProviderType;
  }) {
    const conversation = this.getCurrentConversation();
    if (conversation) {
      if (settings.mode) conversation.mode = settings.mode;
      if (settings.model) conversation.model = settings.model;
      if (settings.provider) conversation.provider = settings.provider;
      conversation.updatedAt = Date.now();
      this._saveConversations();
    }
  }

  private _generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private _generateTitle(content: string): string {
    // Take first 50 characters of the message as title
    const title = content.trim().substring(0, 50);
    return title.length < content.length ? `${title}...` : title;
  }

  private _loadConversations() {
    const stored = this._extensionContext.globalState.get<{
      conversations: [string, Conversation][];
      currentId: string | null;
    }>('mysti.conversations');

    if (stored) {
      this._conversations = new Map(stored.conversations);
      this._currentConversationId = stored.currentId;
    }
  }

  private _saveConversations() {
    this._extensionContext.globalState.update('mysti.conversations', {
      conversations: Array.from(this._conversations.entries()),
      currentId: this._currentConversationId
    });
  }
}
