'use client';

import { useCollaborationStore } from '@/store/collaborationStore';
import { Users, Wifi, WifiOff, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

export default function CollaborationPanel() {
  const { isConnected, collaborators, currentUser } = useCollaborationStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  
  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed top-20 right-6 glass rounded-lg p-3 shadow-xl hover:scale-105 transition-transform z-40"
        title="Show Collaboration"
      >
        <Users className="w-5 h-5 text-slate-300" />
      </button>
    );
  }
  
  return (
    <div className="fixed top-20 right-6 bg-slate-900/95 backdrop-blur-xl border border-purple-500/20 rounded-xl shadow-xl z-40 min-w-[200px] max-w-[300px]">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-800/50 transition-colors rounded-t-xl"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-white">Коллаборация</span>
          {collaborators.length > 0 && (
            <span className="px-2 py-0.5 bg-purple-600/20 text-purple-400 text-xs rounded-full">
              {collaborators.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Wifi className="w-3 h-3 text-green-500" />
          ) : (
            <WifiOff className="w-3 h-3 text-slate-500" />
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>
      
      {/* Content */}
      {isExpanded && (
        <div className="p-3 pt-0 border-t border-slate-700">
          {/* Status */}
          <div className="mb-3 pb-3 border-b border-slate-700">
            <div className="text-xs text-slate-400 mb-1">Статус</div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs text-green-400">Онлайн</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-slate-500 rounded-full" />
                  <span className="text-xs text-slate-500">Оффлайн</span>
                </>
              )}
            </div>
          </div>

          {/* Current User */}
          {currentUser && (
            <div className="mb-3 pb-3 border-b border-slate-700">
              <div className="text-xs text-slate-400 mb-2">Вы</div>
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: currentUser.color }}
                />
                <span className="text-sm text-white font-medium truncate">{currentUser.name}</span>
              </div>
            </div>
          )}

          {/* Collaborators */}
          <div>
            <div className="text-xs text-slate-400 mb-2">
              Активные пользователи ({collaborators.length})
            </div>

            {collaborators.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">Никого нет</p>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {collaborators.map((collab) => (
                  <div key={collab.id} className="flex items-center gap-2 p-2 hover:bg-slate-800/50 rounded transition-colors">
                    <div
                      className="w-3 h-3 rounded-full animate-pulse"
                      style={{ backgroundColor: collab.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-200 truncate">{collab.name}</div>
                      {collab.selectedEntity && (
                        <div className="text-xs text-slate-500">Редактирует...</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Close button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsVisible(false);
            }}
            className="mt-3 w-full p-2 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          >
            Скрыть панель
          </button>
        </div>
      )}
    </div>
  );
}
