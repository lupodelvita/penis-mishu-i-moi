'use client';

import { useState, useRef, useEffect } from 'react';
import { useAIAssistantStore } from '@/store/aiStore';
import { useGraphStore } from '@/store';
import { Send, Sparkles, X, Minimize2, Maximize2, Lightbulb, TrendingUp, ThumbsUp, ThumbsDown } from 'lucide-react';

interface AIAssistantProps {
  isOpen?: boolean;
  onToggle?: () => void;
}

export default function AIAssistant({ isOpen: externalIsOpen, onToggle }: AIAssistantProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = onToggle || setInternalIsOpen;
  
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Track feedback for messages to prevent double voting
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, number>>({});
  
  const { messages, isProcessing, sendMessage, clearHistory, analyzeGraph, suggestNextSteps, sendFeedback } = useAIAssistantStore();
  const { currentGraph, selectedEntities } = useGraphStore();
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;
    
    await sendMessage(input);
    setInput('');
  };
  
  const handleFeedback = async (messageId: string, content: string, rating: number) => {
    if (feedbackGiven[messageId]) return;
    
    // Find the user request that triggered this response (usually the previous message)
    // For simplicity in this mock, we'll send the message id or some context.
    // Ideally the store should link request<->response.
    // Here we'll just send the current response content as "response" and the previous user message as "content" (simplified).
    
    const msgIndex = messages.findIndex(m => m.id === messageId);
    let requestContent = "unknown context";
    let requestType = "chat";
    
    if (msgIndex > 0) {
      const prevMsg = messages[msgIndex - 1];
      if (prevMsg.role === 'user') {
        requestContent = prevMsg.content;
      }
    }

    // Heuristic to guess type if not explicit (in a real app, message metadata would hold this)
    if (content.includes('Анализ графа')) requestType = 'analysis';
    else if (content.includes('Предложения')) requestType = 'suggestion';
    
    await sendFeedback(requestType, requestContent, content, rating);
    
    setFeedbackGiven(prev => ({ ...prev, [messageId]: rating }));
  };

  const handleAnalyze = async () => {
    if (!currentGraph) return;
    const analysis = await analyzeGraph(currentGraph);
    await sendMessage(`Проанализируй мой граф:\n${analysis}`);
  };
  
  const handleSuggest = async () => {
    if (selectedEntities.length === 0) {
      await sendMessage('Пожалуйста, выберите сущность, чтобы получить рекомендации.');
      return;
    }
    
    const suggestions = await suggestNextSteps(selectedEntities[0]);
    await sendMessage(`Предложения для ${selectedEntities[0].value}:\n${suggestions.join('\n')}`);
  };

  // Don't show floating button when controlled externally
  if (!isOpen && externalIsOpen === undefined) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 p-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 z-50 group"
        title="AI Assistant"
      >
        <Sparkles className="w-6 h-6 text-white" />
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900 animate-pulse" />
      </button>
    );
  }

  if (!isOpen && externalIsOpen === false) return null;

  return (
    <div className={`fixed ${isMinimized ? 'bottom-6 right-6 w-80' : 'bottom-6 right-6 w-96 h-[600px]'} bg-slate-900/95 backdrop-blur-xl border border-purple-500/20 rounded-2xl shadow-2xl z-50 flex flex-col transition-all duration-300`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-purple-500/20">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">AI Ассистент</h3>
            <p className="text-xs text-slate-400">На базе NodeWeaver AI</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            title={isMinimized ? "Развернуть" : "Свернуть"}
          >
            {isMinimized ? (
              <Maximize2 className="w-4 h-4 text-slate-400" />
            ) : (
              <Minimize2 className="w-4 h-4 text-slate-400" />
            )}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            title="Закрыть"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>
      
      {!isMinimized && (
        <>
          {/* Quick Actions */}
          <div className="p-4 border-b border-purple-500/20 flex gap-2">
            <button
              onClick={handleAnalyze}
              disabled={!currentGraph || isProcessing}
              className="flex-1 px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 rounded-lg text-sm text-purple-300 flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <TrendingUp className="w-4 h-4" />
              Анализ графа
            </button>
            <button
              onClick={handleSuggest}
              disabled={selectedEntities.length === 0 || isProcessing}
              className="flex-1 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 rounded-lg text-sm text-blue-300 flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Lightbulb className="w-4 h-4" />
              Советы
            </button>
          </div>
          
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-slate-400 py-8">
                <Sparkles className="w-12 h-12 mx-auto mb-4 text-purple-500" />
                <p className="text-sm">Спросите меня о чем угодно по вашему расследованию!</p>
                <p className="text-xs mt-2">Я могу анализировать графы, предлагать трансформы и находить паттерны.</p>
              </div>
            )}
            
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                      : 'bg-slate-800 text-slate-200'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p className="text-xs opacity-60 mt-1">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
                </div>
                
                {message.role === 'assistant' && (
                  <div className="flex gap-2 mt-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleFeedback(message.id, message.content, 1)}
                      className={`p-1 hover:text-green-400 transition-colors ${feedbackGiven[message.id] === 1 ? 'text-green-500' : 'text-slate-500'}`}
                      disabled={!!feedbackGiven[message.id]}
                      title="Хороший ответ (обучить агента)"
                    >
                      <ThumbsUp className="w-3 h-3" />
                    </button>
                    <button 
                      onClick={() => handleFeedback(message.id, message.content, -1)}
                      className={`p-1 hover:text-red-400 transition-colors ${feedbackGiven[message.id] === -1 ? 'text-red-500' : 'text-slate-500'}`}
                      disabled={!!feedbackGiven[message.id]}
                      title="Плохой ответ"
                    >
                      <ThumbsDown className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
            
            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-slate-800 px-4 py-2 rounded-2xl">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
          
          {/* Input */}
          <div className="p-4 border-t border-purple-500/20">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Спросите меня о чем-нибудь..."
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isProcessing}
                className="p-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </div>
            
            {messages.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-xs text-slate-500 hover:text-slate-400 mt-2 transition-colors"
              >
                Очистить историю
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
