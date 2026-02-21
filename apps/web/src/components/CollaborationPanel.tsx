'use client';

import { useCollaborationStore } from '@/store/collaborationStore';
import { Users, Wifi, WifiOff, ChevronDown, ChevronUp, Send, LogOut, UserPlus, LogIn, Copy, UserMinus, Crown, X, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

export default function CollaborationPanel() {
  const { isConnected, collaborators, currentUser, commandHistory, broadcastChatMessage, inviteUser, leaveGraph, isLeader, graphId, joinGraph, kickUser, promoteToLeader, disconnectReason, clearDisconnectReason } = useCollaborationStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [chatMessage, setChatMessage] = useState('');
  const [inviteUserId, setInviteUserId] = useState('');
  const [inviteUserName, setInviteUserName] = useState('');
  const [graphIdToJoin, setGraphIdToJoin] = useState('');
  const [copiedGraphId, setCopiedGraphId] = useState(false);
  
  const copyGraphId = () => {
    if (graphId) {
      navigator.clipboard.writeText(graphId);
      setCopiedGraphId(true);
      setTimeout(() => setCopiedGraphId(false), 2000);
    }
  };
  
  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-6 right-4 lg:right-[340px] glass rounded-lg p-3 shadow-xl hover:scale-105 transition-transform z-40"
        title="Show Collaboration"
      >
        <Users className="w-5 h-5 text-slate-300" />
      </button>
    );
  }
  
  return (
    <div className="fixed bottom-6 right-4 lg:right-[340px] bg-slate-900/95 backdrop-blur-xl border border-purple-500/20 rounded-xl shadow-xl z-40 min-w-[200px] max-w-[300px]">
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
      
      {/* Disconnect Reason Banner */}
      {disconnectReason && (
        <div className="mx-3 mt-2 p-2.5 bg-red-900/40 border border-red-500/30 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-red-300 font-medium leading-relaxed">{disconnectReason}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearDisconnectReason();
            }}
            className="p-0.5 hover:bg-red-800/50 rounded transition-colors flex-shrink-0"
          >
            <X className="w-3 h-3 text-red-400" />
          </button>
        </div>
      )}
      
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
                {isLeader && (
                  <span title="Лидер"><Crown className="w-3 h-3 text-yellow-500" /></span>
                )}
              </div>
            </div>
          )}

          {/* Graph ID - Only show if in a graph */}
          {graphId && (
            <div className="mb-3 pb-3 border-b border-slate-700">
              <div className="text-xs text-slate-400 mb-2">ID графа</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 truncate font-mono">
                  {graphId.slice(0, 12)}...
                </div>
                <button
                  onClick={copyGraphId}
                  className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded transition-colors"
                  title="Скопировать полный ID"
                >
                  {copiedGraphId ? '✓' : <Copy className="w-3 h-3" />}
                </button>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Поделитесь этим ID для совместной работы</div>
            </div>
          )}

          {/* Chat Messages */}
          <div className="mb-3 pb-3 border-b border-slate-700">
            <div className="text-xs text-slate-400 mb-2 font-semibold">История действий</div>
            <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1">
              {commandHistory.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">Пусто</p>
              ) : (
                commandHistory.slice().reverse().map((cmd) => {
                  let displayText = '';
                  let emoji = '•';
                  
                  switch (cmd.type) {
                    case 'add_entity':
                      emoji = '➕';
                      displayText = `Добавлена сущность`;
                      break;
                    case 'delete_entity':
                      emoji = '➖';
                      displayText = `Удалена сущность`;
                      break;
                    case 'transform':
                      emoji = '🔄';
                      const transformName = cmd.payload?.transformId || 'трансформ';
                      const resultCount = cmd.payload?.resultCount || 0;
                      displayText = `${transformName} (${resultCount} результатов)`;
                      break;
                    case 'chat':
                      emoji = '💬';
                      displayText = `${cmd.payload?.sender}: ${cmd.payload?.message}`;
                      break;
                    case 'add_link':
                      emoji = '🔗';
                      displayText = `Добавлена связь`;
                      break;
                    case 'delete_link':
                      emoji = '✂️';
                      displayText = `Удалена связь`;
                      break;
                    default:
                      displayText = cmd.type;
                  }
                  
                  const timestamp = new Date(cmd.timestamp);
                  const timeStr = timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                  
                  return (
                    <div key={cmd.id} className="text-xs px-2 py-1.5 rounded bg-slate-800/40 hover:bg-slate-800/60 transition-colors border border-slate-700/50">
                      <div className="flex items-start justify-between gap-2 min-h-[20px]">
                        <div className="flex items-start gap-1 flex-1 min-w-0">
                          <span className="flex-shrink-0 mt-0.5">{emoji}</span>
                          <span className="text-slate-300 break-words flex-1 leading-tight">{displayText}</span>
                        </div>
                        <span className="text-slate-500 text-[10px] whitespace-nowrap flex-shrink-0 ml-1">{timeStr}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Chat Input */}
          {isConnected && (
            <div className="flex gap-2 mb-3 pb-3 border-b border-slate-700">
              <input
                type="text"
                placeholder="Сообщение..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && chatMessage.trim()) {
                    broadcastChatMessage(chatMessage);
                    setChatMessage('');
                  }
                }}
                className="flex-1 px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={() => {
                  if (chatMessage.trim()) {
                    broadcastChatMessage(chatMessage);
                    setChatMessage('');
                  }
                }}
                className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-white"
              >
                <Send className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Join Graph Section - Only show if not in a graph */}
          {isConnected && !graphId && (
            <div className="mb-3 pb-3 border-b border-slate-700">
              <div className="text-xs text-slate-400 mb-2 font-semibold">Присоединиться к графу</div>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="Введите UUID графа..."
                  value={graphIdToJoin}
                  onChange={(e) => setGraphIdToJoin(e.target.value)}
                  className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (graphIdToJoin.trim()) {
                        joinGraph(graphIdToJoin.trim());
                      }
                    }}
                    disabled={!graphIdToJoin.trim()}
                    className="flex-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-1"
                  >
                    <LogIn className="w-3 h-3" />
                    Войти
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const token = localStorage.getItem('token');
                        if (!token) return;
                        
                        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/graphs/`, {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            name: 'Новый граф',
                            description: 'Создано через панель коллаборации'
                          }),
                        });
                        
                        if (response.ok) {
                          const data = await response.json();
                          joinGraph(data.data.id);
                        }
                      } catch (error) {
                        console.error('Failed to create graph:', error);
                      }
                    }}
                    className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-1"
                    title="Создать новый граф"
                  >
                    <UserPlus className="w-3 h-3" />
                    Создать
                  </button>
                </div>
                <div className="text-[10px] text-slate-500">
                  Можно войти по ID графа или создать новый
                </div>
              </div>
            </div>
          )}

          {/* Invite Section - Only for leaders who are in a graph */}
          {isConnected && graphId && isLeader && (
            <div className="mb-3 pb-3 border-b border-slate-700">
              <div className="text-xs text-slate-400 mb-2 font-semibold">Пригласить участника</div>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="ID пользователя"
                  value={inviteUserId}
                  onChange={(e) => setInviteUserId(e.target.value)}
                  className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
                <input
                  type="text"
                  placeholder="Имя пользователя"
                  value={inviteUserName}
                  onChange={(e) => setInviteUserName(e.target.value)}
                  className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={() => {
                    if (inviteUserId.trim() && inviteUserName.trim()) {
                      inviteUser(inviteUserId, inviteUserName);
                      setInviteUserId('');
                      setInviteUserName('');
                    }
                  }}
                  className="w-full px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-1"
                >
                  <UserPlus className="w-3 h-3" />
                  Пригласить
                </button>
              </div>
            </div>
          )}

          {/* Leave Graph Button - Only show if user is in a graph */}
          {isConnected && graphId && (
            <div className="mb-3 pb-3 border-b border-slate-700">
              <button
                onClick={() => leaveGraph()}
                className="w-full px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-1"
              >
                <LogOut className="w-3 h-3" />
                Покинуть граф
              </button>
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
                      className="w-3 h-3 rounded-full animate-pulse flex-shrink-0"
                      style={{ backgroundColor: collab.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-slate-200 truncate">{collab.name}</span>
                        {collab.isLeader && (
                          <span title="Лидер"><Crown className="w-3 h-3 text-yellow-500 flex-shrink-0" /></span>
                        )}
                      </div>
                      {collab.selectedEntity && (
                        <div className="text-xs text-slate-500">Редактирует...</div>
                      )}
                    </div>
                    
                    {/* Leader controls */}
                    {isLeader && graphId && (
                      <div className="flex gap-1 flex-shrink-0">
                        {!collab.isLeader && (
                          <button
                            onClick={() => promoteToLeader(collab.id)}
                            className="px-1.5 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded transition-colors"
                            title="Назначить лидером"
                          >
                            <Crown className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={() => kickUser(collab.id)}
                          className="px-1.5 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                          title="Исключить из графа"
                        >
                          <UserMinus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
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
