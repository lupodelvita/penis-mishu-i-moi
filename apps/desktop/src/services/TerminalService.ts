import * as pty from 'node-pty';
import { ipcMain, IpcMainEvent, app } from 'electron';
import os from 'os';
import path from 'path';

export class TerminalService {
  private ptySession: pty.IPty | null = null;

  constructor() {
    this.setupIpcHandlers();
  }

  private setupIpcHandlers() {
    ipcMain.on('terminal:create', (event) => this.ensureSession(event));
    ipcMain.on('terminal:write', (_, data: string) => this.write(data));
    ipcMain.on('terminal:resize', (_, cols: number, rows: number) => this.resize(cols, rows));
  }

  private ensureSession(event: IpcMainEvent) {
    // If session exists, just attach listener to this renderer
    if (this.ptySession) {
      console.log('[TerminalService] Session exists, attaching renderer');
      this.attachRenderer(event);
      return;
    }

    // Create new persistent session
    const isWin = os.platform() === 'win32';
    const shell = isWin ? 'powershell.exe' : 'bash';
    const shellArgs = isWin ? ['-NoExit', '-NoLogo'] : [];
    
    // CRITICAL: Start in NodeWeaver project directory
    const projectPath = path.join(app.getAppPath(), '..', '..');
    console.log(`[TerminalService] Creating session in: ${projectPath}`);

    try {
      this.ptySession = pty.spawn(shell, shellArgs, {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: projectPath,
        env: process.env as any,
      });

      console.log(`[TerminalService] Session created. PID: ${this.ptySession.pid}`);
      
      // Set custom prompt and clear screen
      if (isWin) {
        setTimeout(() => {
          // Define custom prompt function
          this.ptySession?.write('function prompt { "NodeWeaver> " }\r');
          setTimeout(() => {
            this.ptySession?.write('Clear-Host\r');
          }, 300);
        }, 1200);
      }

      this.ptySession.onExit(({ exitCode }) => {
        console.log(`[TerminalService] Session exited with code ${exitCode}`);
        this.ptySession = null;
      });

      this.attachRenderer(event);
    } catch (error) {
      console.error('[TerminalService] Failed to create session:', error);
    }
  }

  private attachRenderer(event: IpcMainEvent) {
    if (!this.ptySession) return;

    // Send data to this specific renderer
    this.ptySession.onData((data) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('terminal:data', data);
      }
    });

    console.log('[TerminalService] Renderer attached');
  }

  private write(data: string) {
    if (!this.ptySession) {
      console.warn('[TerminalService] Cannot write: no active session');
      return;
    }
    this.ptySession.write(data);
  }

  private resize(cols: number, rows: number) {
    if (!this.ptySession) return;
    try {
      this.ptySession.resize(cols, rows);
    } catch (error) {
      console.error('[TerminalService] Resize error:', error);
    }
  }

  dispose() {
    if (this.ptySession) {
      console.log('[TerminalService] Killing session on app shutdown');
      this.ptySession.kill();
      this.ptySession = null;
    }
  }
}
