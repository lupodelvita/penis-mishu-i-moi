'use client';
import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { X, Maximize2, Minimize2, Terminal as TerminalIcon } from 'lucide-react';

interface TerminalConsoleProps {
  isOpen: boolean;
  onClose: () => void;
  initialCommand?: string;
}

export default function TerminalConsole({ isOpen, onClose, initialCommand }: TerminalConsoleProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  // Initialize Terminal - runs once
  useEffect(() => {
    if (!isOpen || !terminalRef.current) return;

    // Only create terminal instance once
    if (!xtermRef.current) {
        const term = new Terminal({
            cursorBlink: true,
            theme: {
                background: '#0f172a',
                foreground: '#f8fafc',
                cursor: '#22c55e',
                selectionBackground: '#22c55e44',
                black: '#000000',
                red: '#ef4444',
                green: '#22c55e',
                yellow: '#eab308',
                blue: '#3b82f6',
                magenta: '#d946ef',
                cyan: '#06b6d4',
                white: '#ffffff',
            },
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            fontSize: 14,
            allowProposedApi: true
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        
        term.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        const win = window as any;
        
        if (win.electron?.terminal) {
            // Create/attach to persistent session
            win.electron.terminal.create();

            // Handle user input
            term.onData((data: string) => {
                win.electron.terminal.write(data);
            });

            // Handle terminal resize
            term.onResize((size: { cols: number, rows: number }) => {
                win.electron.terminal.resize(size.cols, size.rows);
            });
            
            // Handle output from backend - WITH AUTO-SCROLL
            const cleanup = win.electron.terminal.onData((data: string) => {
                term.write(data);
                // CRITICAL: Scroll to bottom on EVERY write
                term.scrollToBottom();
            });

            // Use ResizeObserver for robust sizing (debounced to prevent warnings)
            let resizeTimeout: NodeJS.Timeout;
            const resizeObserver = new ResizeObserver(() => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    if (terminalRef.current && fitAddonRef.current) {
                        try {
                             fitAddonRef.current.fit();
                        } catch (e) { /* silently ignore fit errors */ }
                    }
                }, 100); // Debounce by 100ms
            });
            resizeObserver.observe(terminalRef.current);

            setTimeout(() => {
                 // Force immediate fit once
                 if (fitAddonRef.current) fitAddonRef.current.fit();
                 xtermRef.current?.focus(); 

                 // If command provided, write it
                 if (initialCommand) {
                    console.log('Sending initial command:', initialCommand);
                    win.electron.terminal.write(initialCommand + '\r\n');
                 }
            }, 300);

            // Cleanup
            return () => {
                cleanup();
                resizeObserver.disconnect();
                xtermRef.current = null;
            };
        }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
        className={`fixed z-50 bg-[#0f172a] border-t border-slate-700 shadow-2xl transition-all duration-300 flex flex-col ${
            isMaximized ? 'inset-0' : 'bottom-0 left-0 right-0 h-[400px]'
        }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800/50 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <TerminalIcon size={16} className="text-green-400" />
          <span className="text-sm font-medium text-slate-200">NodeWeaver Terminal</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1 hover:bg-slate-700 rounded transition-colors"
            title={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? (
              <Minimize2 size={16} className="text-slate-400" />
            ) : (
              <Maximize2 size={16} className="text-slate-400" />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-red-500/20 rounded transition-colors"
            title="Close"
          >
            <X size={16} className="text-red-400" />
          </button>
        </div>
      </div>

      {/* Terminal */}
      <div ref={terminalRef} className="flex-1 p-2" />
    </div>
  );
}
