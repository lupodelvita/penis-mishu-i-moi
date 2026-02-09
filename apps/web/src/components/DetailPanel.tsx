'use client';

import { Info, Tag, Clock, Edit3, Plus, X, Upload, FileText } from 'lucide-react';
import { useGraphStore } from '@/store';
import { useState, useEffect } from 'react';

interface DetailPanelProps {
  selectedEntityId: string | null;
}

export default function DetailPanel({ selectedEntityId }: DetailPanelProps) {
  const { currentGraph, updateEntity } = useGraphStore();
  const [noteInput, setNoteInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);

  const selectedEntity = currentGraph?.entities.find(e => e.id === selectedEntityId);

  const [localValue, setLocalValue] = useState('');

  useEffect(() => {
    if (selectedEntity) {
      setLocalValue(selectedEntity.data?.label || selectedEntity.value);
      setNoteInput(selectedEntity.data?.notes || '');
    }
  }, [selectedEntityId, selectedEntity]);

  const handleValueCommit = () => {
      if (selectedEntity && localValue !== selectedEntity.value) {
          updateEntity(selectedEntityId!, { 
              value: localValue,
              data: { ...selectedEntity.data, label: localValue } 
          });
      }
  };

  const handleNoteChange = (text: string) => {
      setNoteInput(text);
      if (selectedEntity) {
          updateEntity(selectedEntityId!, {
              data: { ...selectedEntity.data, notes: text }
          });
      }
  };

  const addTag = () => {
      if (!tagInput.trim() || !selectedEntityId || !selectedEntity) return;
      const currentTags = selectedEntity.data?.tags || [];
      if (!currentTags.includes(tagInput.trim())) {
          updateEntity(selectedEntityId, {
              data: { ...selectedEntity.data, tags: [...currentTags, tagInput.trim()] }
          });
      }
      setTagInput('');
      setShowTagInput(false);
  };

  const removeTag = (tag: string) => {
      if (!selectedEntityId || !selectedEntity) return;
      const currentTags = selectedEntity.data?.tags || [];
      updateEntity(selectedEntityId, {
          data: { ...selectedEntity.data, tags: currentTags.filter((t: string) => t !== tag) }
      });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedEntityId || !selectedEntity) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      
      if (data.success) {
        const newProps = {
            ...selectedEntity.data?.properties,
            url: data.data.url,
            filename: data.data.originalName,
            size: data.data.size,
            mimeType: data.data.mimeType
        };
        
        updateEntity(selectedEntityId, { 
            properties: newProps,
            data: { ...selectedEntity.data, properties: newProps }
        });
      } else {
        alert('Upload failed: ' + data.error);
      }
    } catch (err) {
      console.error('Upload failed', err);
      alert('Upload failed. Ensure API is running.');
    }
  };

  if (!selectedEntityId || !selectedEntity) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold">Детали</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-muted-foreground text-sm">
            Выберите сущность для просмотра деталей
          </div>
        </div>
      </div>
    );
  }

  // ... (previous handlers)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold">Детали</h2>
          <button className="p-1 hover:bg-accent rounded-md transition-colors text-muted-foreground" title="Редактировать">
            <Edit3 className="w-4 h-4" />
          </button>
        </div>
        <div className="text-xs text-muted-foreground">{selectedEntity.data?.type || 'Entity'}</div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Value */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Значение
          </div>
          <input
            type="text"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleValueCommit}
            onKeyDown={(e) => {
                if(e.key === 'Enter') {
                    handleValueCommit();
                    e.currentTarget.blur();
                }
            }}
            className="w-full text-sm font-mono bg-secondary p-2 rounded border border-transparent focus:border-purple-500 focus:outline-none transition-colors"
          />
        </div>

        {/* Created */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Создано
          </div>
          <div className="text-sm">{new Date().toLocaleDateString()}</div>
        </div>

        {/* Properties */}
        {selectedEntity.data?.properties && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Свойства</div>
            <div className="space-y-2">
              {Object.entries(selectedEntity.data.properties).map(([key, value]) => (
                <div key={key} className="bg-secondary/50 p-2 rounded">
                  <div className="text-xs text-muted-foreground capitalize">{key}</div>
                  <div className="text-sm font-medium">
                    {String(value)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <Tag className="w-3 h-3" />
            Теги
          </div>
          <div className="flex flex-wrap gap-1">
            {(selectedEntity.data?.tags || []).map((tag: string) => (
              <span key={tag} className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded flex items-center gap-1">
                {tag}
                <button onClick={() => removeTag(tag)} className="hover:text-red-400">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            
            {showTagInput ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTag()}
                  className="w-20 px-1 py-0.5 bg-secondary text-xs rounded border border-border focus:outline-none focus:border-primary"
                  autoFocus
                  onBlur={() => {
                     if(!tagInput) setShowTagInput(false) 
                  }}
                />
                <button onClick={addTag} className="text-green-500 hover:text-green-400"><Plus className="w-4 h-4" /></button>
              </div>
            ) : (
              <button 
                onClick={() => setShowTagInput(true)}
                className="px-2 py-1 bg-secondary hover:bg-secondary/80 text-xs rounded transition-colors flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Добавить
              </button>
            )}
          </div>
        </div>

        {/* File Upload (Image/Document) */}
        {['image', 'document'].includes(selectedEntity.type) && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
               <Upload className="w-3 h-3" />
               Файл
            </div>
            
            {(selectedEntity.data?.properties?.url || (selectedEntity as any).properties?.url) ? (
               <div className="bg-secondary p-2 rounded">
                  {selectedEntity.type === 'image' ? (
                    <div className="relative group">
                       <img 
                         src={selectedEntity.data?.properties?.url || (selectedEntity as any).properties?.url} 
                         alt="Uploaded" 
                         className="max-w-full h-auto rounded mb-2 border border-border" 
                       />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mb-2 p-2 bg-background rounded border border-border">
                       <FileText className="w-4 h-4 text-primary" />
                       <a 
                         href={selectedEntity.data?.properties?.url || (selectedEntity as any).properties?.url} 
                         target="_blank" 
                         rel="noopener noreferrer" 
                         className="text-primary hover:underline text-sm truncate flex-1"
                       >
                         {selectedEntity.data?.properties?.filename || 'Скачать файл'}
                       </a>
                    </div>
                  )}
                  <div className="flex justify-end">
                     <label className="text-xs cursor-pointer text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                        <Edit3 className="w-3 h-3" />
                        Заменить
                        <input type="file" className="hidden" onChange={handleFileUpload} />
                     </label>
                  </div>
               </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-md cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors">
                <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">Загрузить файл</span>
                <input type="file" className="hidden" onChange={handleFileUpload} />
              </label>
            )}
          </div>
        )}

        {/* Notes */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">Заметки</div>
          <textarea
            value={noteInput}
            onChange={(e) => handleNoteChange(e.target.value)}
            placeholder="Добавить заметку..."
            className="w-full p-2 bg-secondary border border-border rounded text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            rows={4}
          />
        </div>
      </div>
    </div>
  );
}
