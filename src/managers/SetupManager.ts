/**
 * Mysti - AI Coding Agent
 * Copyright (c) 2025 DeepMyst Inc. All rights reserved.
 *
 * Author: Baha Abunojaim <baha@deepmyst.com>
 * Website: https://deepmyst.com
 *
 * This file is part of Mysti, licensed under the Business Source License 1.1.
 * See the LICENSE file in the project root for full license terms.
 *
 * SPDX-License-Identifier: BUSL-1.1
 */

import * as vscode from 'vscode';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import type { ProviderManager } from './ProviderManager';
import type {
  ProviderSetupStatus,
  SetupResult,
  InstallResult,
  AuthStatus
} from '../types';

const execAsync = promisify(exec);

/**
 * SetupManager orchestrates the CLI setup flow for AI providers.
 *
 * Responsibilities:
 * - Check if any provider CLI is installed and ready
 * - Auto-install CLI via npm when possible
 * - Guide users through authentication
 * - Provide fallback manual instructions when needed
 */
export class SetupManager {
  private _extensionContext: vscode.ExtensionContext;
  private _providerManager: ProviderManager;
  private _npmAvailable: boolean | null = null;

  constructor(context: vscode.ExtensionContext, providerManager: ProviderManager) {
    this._extensionContext = context;
    this._providerManager = providerManager;
  }

  /**
   * Check if npm is available on the system
   */
  async checkNpmAvailable(): Promise<boolean> {
    if (this._npmAvailable !== null) {
      return this._npmAvailable;
    }

    try {
      await execAsync('npm --version');
      this._npmAvailable = true;
      console.log('[Mysti] SetupManager: npm is available');
    } catch {
      this._npmAvailable = false;
      console.log('[Mysti] SetupManager: npm is not available');
    }

    return this._npmAvailable;
  }

  /**
   * Check if any provider is ready (installed and authenticated)
   */
  async checkReady(): Promise<boolean> {
    const statuses = await this.getSetupStatus();
    return statuses.some(s => s.installed && s.authenticated);
  }

  /**
   * Get setup status for all providers
   */
  async getSetupStatus(): Promise<ProviderSetupStatus[]> {
    const statuses: ProviderSetupStatus[] = [];

    for (const provider of this._providerManager.getAllProviders()) {
      const discovery = await provider.discoverCli();
      let authenticated = false;

      if (discovery.found) {
        const authStatus = await provider.checkAuthentication();
        authenticated = authStatus.authenticated;
      }

      statuses.push({
        providerId: provider.id,
        displayName: provider.displayName,
        installed: discovery.found,
        authenticated
      });
    }

    return statuses;
  }

  /**
   * Run the full setup flow for a provider
   * Returns immediately if provider is already ready
   */
  async setupProvider(
    providerId: string,
    onProgress?: (step: string, message: string, progress?: number) => void
  ): Promise<SetupResult> {
    const provider = this._providerManager.getProviderInstance(providerId);
    if (!provider) {
      return {
        success: false,
        installed: false,
        authenticated: false,
        error: `Provider "${providerId}" not found`
      };
    }

    // Step 1: Check if already installed
    onProgress?.('checking', 'Checking CLI installation...', 10);
    const discovery = await provider.discoverCli();

    if (!discovery.found) {
      // Step 2: Try to auto-install
      onProgress?.('installing', `Installing ${provider.displayName} CLI...`, 30);
      const installResult = await this.autoInstallCli(providerId, onProgress);

      if (!installResult.success) {
        return {
          success: false,
          installed: false,
          authenticated: false,
          error: installResult.error,
          requiresManualStep: 'install'
        };
      }
    }

    // Step 3: Check authentication
    onProgress?.('authenticating', 'Checking authentication...', 70);
    const authStatus = await provider.checkAuthentication();

    if (!authStatus.authenticated) {
      return {
        success: false,
        installed: true,
        authenticated: false,
        error: authStatus.error,
        requiresManualStep: 'auth'
      };
    }

    onProgress?.('ready', `${provider.displayName} is ready!`, 100);
    return {
      success: true,
      installed: true,
      authenticated: true
    };
  }

  /**
   * Auto-install CLI via npm
   */
  async autoInstallCli(
    providerId: string,
    onProgress?: (step: string, message: string, progress?: number) => void
  ): Promise<InstallResult> {
    // Check npm availability
    const npmAvailable = await this.checkNpmAvailable();
    if (!npmAvailable) {
      return {
        success: false,
        error: 'npm is not available on your system. Please install Node.js and npm first.',
        requiresManual: true
      };
    }

    const provider = this._providerManager.getProviderInstance(providerId);
    if (!provider) {
      return {
        success: false,
        error: `Provider "${providerId}" not found`
      };
    }

    const installCommand = provider.getInstallCommand();
    console.log(`[Mysti] SetupManager: Running install command: ${installCommand}`);

    onProgress?.('installing', `Running: ${installCommand}`, 40);

    try {
      // Run npm install with timeout
      const result = await this._runCommand(installCommand, 120000); // 2 minute timeout

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Installation failed',
          requiresManual: true
        };
      }

      onProgress?.('installing', 'Verifying installation...', 60);

      // Verify installation
      const discovery = await provider.discoverCli();
      if (!discovery.found) {
        return {
          success: false,
          error: 'Installation completed but CLI not found. You may need to restart your terminal or VS Code.',
          requiresManual: true
        };
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Installation failed: ${errorMessage}`,
        requiresManual: true
      };
    }
  }

  /**
   * Run authentication command for a provider
   * This opens a terminal or browser for the user to complete auth
   */
  async authenticateProvider(providerId: string): Promise<AuthStatus> {
    const provider = this._providerManager.getProviderInstance(providerId);
    if (!provider) {
      return {
        authenticated: false,
        error: `Provider "${providerId}" not found`
      };
    }

    const authCommand = provider.getAuthCommand();
    console.log(`[Mysti] SetupManager: Running auth command: ${authCommand}`);

    // Create a terminal for the user to complete authentication
    const terminal = vscode.window.createTerminal({
      name: `${provider.displayName} Authentication`,
      shellPath: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash'
    });

    terminal.show();
    terminal.sendText(authCommand);

    // Return pending - the user needs to complete auth in the terminal
    // The webview will poll for auth status
    return {
      authenticated: false,
      error: 'Please complete authentication in the terminal window'
    };
  }

  /**
   * Get provider info for manual setup instructions
   */
  getProviderSetupInfo(providerId: string): {
    installCommand: string;
    authCommand: string;
    docsUrl?: string;
  } | null {
    const provider = this._providerManager.getProviderInstance(providerId);
    if (!provider) {
      return null;
    }

    const docsUrls: Record<string, string> = {
      'claude-code': 'https://docs.anthropic.com/claude/docs/claude-code',
      'openai-codex': 'https://platform.openai.com/docs/guides/codex'
    };

    return {
      installCommand: provider.getInstallCommand(),
      authCommand: provider.getAuthCommand(),
      docsUrl: docsUrls[providerId]
    };
  }

  /**
   * Run a command and return the result
   */
  private async _runCommand(
    command: string,
    timeout: number = 60000
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    return new Promise((resolve) => {
      const proc = spawn(command, [], {
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      const timeoutId = setTimeout(() => {
        proc.kill();
        resolve({
          success: false,
          error: 'Command timed out'
        });
      }, timeout);

      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        if (code === 0) {
          resolve({ success: true, output: stdout });
        } else {
          resolve({
            success: false,
            error: stderr || `Command exited with code ${code}`
          });
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          error: err.message
        });
      });
    });
  }
}
