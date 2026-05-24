import { hermesTransport } from './hermesTransport';
import { StoredSession, SessionInfo, HermesMessage, Usage } from '../types/hermes';

export class HermesGateway {
  // --- WebSocket Connection API ---
  public static connect(): Promise<void> {
    return hermesTransport.connect();
  }

  public static disconnect() {
    hermesTransport.disconnect();
  }

  public static isConnected(): boolean {
    return hermesTransport.isConnected();
  }

  public static onEvent(callback: (event: any) => void): () => void {
    return hermesTransport.onEvent(callback);
  }

  // --- Session Methods ---
  public static async createSession(cols?: number): Promise<{ session_id: string; info: SessionInfo }> {
    return hermesTransport.request('session.create', { cols });
  }

  public static async listSessions(limit?: number): Promise<{ sessions: StoredSession[] }> {
    return hermesTransport.request('session.list', { limit });
  }

  public static async resumeSession(
    sessionId: string,
    cols?: number
  ): Promise<{ session_id: string; resumed: string; message_count: number; messages: HermesMessage[]; info: SessionInfo }> {
    return hermesTransport.request('session.resume', { session_id: sessionId, cols });
  }

  public static async deleteSession(sessionId: string): Promise<{ deleted: string }> {
    return hermesTransport.request('session.delete', { session_id: sessionId });
  }

  public static async getOrSetTitle(sessionId: string, title?: string): Promise<{ title: string }> {
    return hermesTransport.request('session.title', { session_id: sessionId, ...(title ? { title } : {}) });
  }

  public static async getUsage(sessionId: string): Promise<{ usage: Usage }> {
    return hermesTransport.request('session.usage', { session_id: sessionId });
  }

  public static async getStatus(sessionId: string): Promise<{ running: boolean; [key: string]: any }> {
    return hermesTransport.request('session.status', { session_id: sessionId });
  }

  public static async getHistory(sessionId: string): Promise<{ count: number; messages: HermesMessage[] }> {
    return hermesTransport.request('session.history', { session_id: sessionId });
  }

  public static async undo(sessionId: string): Promise<{ removed: number }> {
    return hermesTransport.request('session.undo', { session_id: sessionId });
  }

  public static async compressContext(
    sessionId: string,
    focusTopic?: string
  ): Promise<{ status: string; removed: number; usage: Usage; messages: HermesMessage[] }> {
    return hermesTransport.request('session.compress', { session_id: sessionId, focus_topic: focusTopic });
  }

  public static async saveSession(sessionId: string): Promise<{ file: string }> {
    return hermesTransport.request('session.save', { session_id: sessionId });
  }

  public static async closeSession(sessionId: string): Promise<{ closed: boolean }> {
    return hermesTransport.request('session.close', { session_id: sessionId });
  }

  public static async branchSession(
    sessionId: string,
    name?: string
  ): Promise<{ session_id: string; title: string; parent: string }> {
    return hermesTransport.request('session.branch', { session_id: sessionId, name });
  }

  public static async interrupt(sessionId: string): Promise<{ status: 'interrupted' }> {
    return hermesTransport.request('session.interrupt', { session_id: sessionId });
  }

  public static async steer(sessionId: string, text: string): Promise<{ status: 'queued' | 'rejected'; text: string }> {
    return hermesTransport.request('session.steer', { session_id: sessionId, text });
  }

  public static async mostRecentSession(): Promise<{ session?: { id: string; title: string; [key: string]: any } }> {
    return hermesTransport.request('session.most_recent');
  }

  // --- Prompt and Input ---
  public static async submitPrompt(sessionId: string, text: string): Promise<{ status: 'streaming' }> {
    return hermesTransport.request('prompt.submit', { session_id: sessionId, text });
  }

  public static async submitBackgroundPrompt(sessionId: string, text: string): Promise<{ task_id: string }> {
    return hermesTransport.request('prompt.background', { session_id: sessionId, text });
  }

  public static async pasteClipboard(sessionId: string): Promise<{ text?: string; image?: any }> {
    return hermesTransport.request('clipboard.paste', { session_id: sessionId });
  }

  public static async attachImage(sessionId: string, path: string): Promise<{ path: string; name: string }> {
    return hermesTransport.request('image.attach', { session_id: sessionId, path });
  }

  public static async detectDrop(text: string): Promise<{ paths: string[] }> {
    return hermesTransport.request('input.detect_drop', { text });
  }

  // --- Commands & Dispatch ---
  public static async dispatchCommand(sessionId: string, command: string, args?: string): Promise<any> {
    return hermesTransport.request('command.dispatch', { session_id: sessionId, command, args });
  }

  public static async resolveCommand(command: string): Promise<any> {
    return hermesTransport.request('command.resolve', { command });
  }

  public static async catalogCommands(): Promise<{ pairs: [string, string][]; sub: any; categories: any[] }> {
    return hermesTransport.request('commands.catalog');
  }

  public static async execSlash(sessionId: string, command: string): Promise<{ output: string; warning?: string }> {
    return hermesTransport.request('slash.exec', { session_id: sessionId, command });
  }

  // --- Completion ---
  public static async completePath(text: string, cwd?: string): Promise<{ items: Array<{ value: string; [key: string]: any }> }> {
    return hermesTransport.request('complete.path', { text, cwd });
  }

  public static async completeSlash(text: string): Promise<{ items: Array<{ value: string; [key: string]: any }> }> {
    return hermesTransport.request('complete.slash', { text });
  }

  // --- Config ---
  public static async getConfig(key: string, sessionId?: string): Promise<any> {
    return hermesTransport.request('config.get', { key, session_id: sessionId });
  }

  public static async setConfig(key: string, value: any, sessionId?: string): Promise<any> {
    return hermesTransport.request('config.set', { key, value, session_id: sessionId });
  }

  public static async showConfig(): Promise<{ sections: Array<{ title: string; rows: string[][] }> }> {
    return hermesTransport.request('config.show');
  }

  // --- Tools and Toolsets ---
  public static async listTools(sessionId?: string): Promise<{ toolsets: any[] }> {
    return hermesTransport.request('tools.list', { session_id: sessionId });
  }

  public static async showTools(sessionId?: string): Promise<{ sections: any[]; total: number }> {
    return hermesTransport.request('tools.show', { session_id: sessionId });
  }

  public static async configureTools(action: 'enable' | 'disable', names: string[], sessionId?: string): Promise<any> {
    return hermesTransport.request('tools.configure', { action, names, session_id: sessionId });
  }

  public static async listToolsets(sessionId?: string): Promise<{ toolsets: any[] }> {
    return hermesTransport.request('toolsets.list', { session_id: sessionId });
  }

  // --- Skills ---
  public static async manageSkills(params: {
    action?: 'list' | 'search' | 'install' | 'browse' | 'inspect';
    query?: string;
    page?: number;
    page_size?: number;
  }): Promise<any> {
    return hermesTransport.request('skills.manage', params);
  }

  public static async reloadSkills(): Promise<{ added: string[]; removed: string[]; total: number }> {
    return hermesTransport.request('skills.reload');
  }

  // --- Voice ---
  public static async recordVoice(action: 'start' | 'stop', sessionId?: string): Promise<{ status: string }> {
    return hermesTransport.request('voice.record', { action, session_id: sessionId });
  }

  public static async toggleVoice(action: 'status' | 'on' | 'off' | 'tts'): Promise<any> {
    return hermesTransport.request('voice.toggle', { action });
  }

  public static async speakTTS(text: string): Promise<{ status: string }> {
    return hermesTransport.request('voice.tts', { text });
  }

  // --- Delegation ---
  public static async getDelegationStatus(): Promise<any> {
    return hermesTransport.request('delegation.status');
  }

  public static async pauseDelegation(paused: boolean): Promise<{ paused: boolean }> {
    return hermesTransport.request('delegation.pause', { paused });
  }

  public static async interruptSubagent(subagentId: string): Promise<{ found: boolean; subagent_id: string }> {
    return hermesTransport.request('subagent.interrupt', { subagent_id: subagentId });
  }

  // --- Browser ---
  public static async manageBrowser(action: string, params: Record<string, any> = {}): Promise<any> {
    return hermesTransport.request('browser.manage', { action, ...params });
  }

  // --- Shell and CLI ---
  public static async execShell(command: string, cwd?: string, timeout?: number): Promise<{ stdout: string; stderr: string; returncode: number }> {
    return hermesTransport.request('shell.exec', { command, cwd, timeout });
  }

  public static async execCli(sessionId: string, command: string): Promise<{ output: string }> {
    return hermesTransport.request('cli.exec', { session_id: sessionId, command });
  }

  public static async resizeTerminal(sessionId: string, cols: number): Promise<{ cols: number }> {
    return hermesTransport.request('terminal.resize', { session_id: sessionId, cols });
  }

  // --- Setup and Process ---
  public static async getSetupStatus(): Promise<{ provider_configured: boolean }> {
    return hermesTransport.request('setup.status');
  }

  public static async stopProcess(): Promise<{ killed: number }> {
    return hermesTransport.request('process.stop');
  }

  // --- Reload ---
  public static async reloadEnv(): Promise<{ status: string }> {
    return hermesTransport.request('reload.env');
  }

  public static async reloadMcp(sessionId?: string, confirm = true): Promise<{ status: string }> {
    return hermesTransport.request('reload.mcp', { session_id: sessionId, confirm });
  }

  // --- Rollback ---
  public static async getRollbackDiff(sessionId: string, ref?: string): Promise<{ diff: string }> {
    return hermesTransport.request('rollback.diff', { session_id: sessionId, ref });
  }

  public static async listRollbacks(sessionId: string): Promise<{ checkpoints: any[] }> {
    return hermesTransport.request('rollback.list', { session_id: sessionId });
  }

  public static async restoreRollback(sessionId: string, ref: string): Promise<{ restored: boolean }> {
    return hermesTransport.request('rollback.restore', { session_id: sessionId, ref });
  }

  // --- Spawn Tree ---
  public static async listSpawnTree(sessionId?: string, limit?: number, crossSession = false): Promise<{ entries: any[] }> {
    return hermesTransport.request('spawn_tree.list', { session_id: sessionId, limit, cross_session: crossSession });
  }

  public static async loadSpawnTree(path: string): Promise<any> {
    return hermesTransport.request('spawn_tree.load', { path });
  }

  public static async saveSpawnTree(sessionId: string, subagents: any[], startedAt?: number, finishedAt?: number, label?: string): Promise<{ path: string; session_id: string }> {
    return hermesTransport.request('spawn_tree.save', { session_id: sessionId, subagents, started_at: startedAt, finished_at: finishedAt, label });
  }

  // --- Background Agents / Cron / Insights / Plugins / Paste ---
  public static async listAgents(): Promise<{ processes: any[] }> {
    return hermesTransport.request('agents.list');
  }

  public static async manageCron(params: {
    action: 'list' | 'add' | 'remove' | 'pause' | 'resume';
    name?: string;
    schedule?: string;
    prompt?: string;
  }): Promise<any> {
    return hermesTransport.request('cron.manage', params);
  }

  public static async getInsights(): Promise<any> {
    return hermesTransport.request('insights.get');
  }

  public static async getModelOptions(sessionId?: string): Promise<{ providers: any[] }> {
    return hermesTransport.request('model.options', { session_id: sessionId });
  }

  public static async saveModelKey(slug: string, apiKey: string): Promise<any> {
    return hermesTransport.request('model.save_key', { slug, api_key: apiKey });
  }

  public static async disconnectModel(slug: string): Promise<{ disconnected: boolean }> {
    return hermesTransport.request('model.disconnect', { slug });
  }

  public static async listPlugins(): Promise<{ plugins: any[] }> {
    return hermesTransport.request('plugins.list');
  }

  public static async collapsePaste(text: string): Promise<{ text: string; collapsed: boolean }> {
    return hermesTransport.request('paste.collapse', { text });
  }

  // --- Approvals & Blocking Prompts ---
  public static async respondApproval(sessionId: string, choice: string, all = false): Promise<{ resolved: boolean }> {
    return hermesTransport.request('approval.respond', { session_id: sessionId, choice, all });
  }

  public static async respondClarify(requestId: string, answer: string): Promise<{ status: string }> {
    return hermesTransport.request('clarify.respond', { request_id: requestId, answer });
  }

  public static async respondSudo(requestId: string, password: string): Promise<{ status: string }> {
    return hermesTransport.request('sudo.respond', { request_id: requestId, password });
  }

  public static async respondSecret(requestId: string, value: string): Promise<{ status: string }> {
    return hermesTransport.request('secret.respond', { request_id: requestId, value });
  }
}
export default HermesGateway;
