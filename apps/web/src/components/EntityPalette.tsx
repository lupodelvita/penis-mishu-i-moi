'use client';

import { useState, memo } from 'react';
import { Search, Globe, Mail, User, Building, MapPin, Phone, Hash, FileText, Image as ImageIcon, Twitter, Facebook, Instagram, Linkedin, Youtube, MessageCircle, Video } from 'lucide-react';
import { EntityType } from '@nodeweaver/shared-types';

const ENTITY_GROUPS = [
  {
    title: 'Сеть (Network)',
    items: [
      { type: EntityType.Domain, icon: Globe, label: 'Домен', color: 'text-blue-500' },
      { type: EntityType.IPAddress, icon: Hash, label: 'IP Адрес', color: 'text-green-500' },
      { type: EntityType.URL, icon: Globe, label: 'Ссылка', color: 'text-indigo-500' },
    ]
  },
  {
    title: 'Контакты',
    items: [
      { type: EntityType.EmailAddress, icon: Mail, label: 'Email', color: 'text-purple-500' },
      { type: EntityType.PhoneNumber, icon: Phone, label: 'Телефон', color: 'text-cyan-500' },
    ]
  },
  {
    title: 'Сущности',
    items: [
      { type: EntityType.Person, icon: User, label: 'Человек', color: 'text-yellow-500' },
      { type: EntityType.Organization, icon: Building, label: 'Организация', color: 'text-orange-500' },
      { type: EntityType.Location, icon: MapPin, label: 'Локация', color: 'text-red-500' },
      { type: EntityType.TextNote, icon: FileText, label: 'Текстовая заметка', color: 'text-slate-400' },
    ]
  },
  {
    title: 'Файлы',
    items: [
      { type: EntityType.Image, icon: ImageIcon, label: 'Изображение', color: 'text-pink-500' },
      { type: EntityType.Document, icon: FileText, label: 'Документ', color: 'text-gray-500' },
    ]
  },
  {
    title: 'Соц. Сети',
    items: [
      { type: EntityType.SocialProfile, preset: 'Telegram', icon: MessageCircle, label: 'Telegram', color: 'text-blue-400' },
      { type: EntityType.SocialProfile, preset: 'Instagram', icon: Instagram, label: 'Instagram', color: 'text-pink-600' },
      { type: EntityType.SocialProfile, preset: 'Twitter', icon: Twitter, label: 'Twitter/X', color: 'text-sky-500' },
      { type: EntityType.SocialProfile, preset: 'Facebook', icon: Facebook, label: 'Facebook', color: 'text-blue-700' },
      { type: EntityType.SocialProfile, preset: 'LinkedIn', icon: Linkedin, label: 'LinkedIn', color: 'text-blue-800' },
      { type: EntityType.SocialProfile, preset: 'TikTok', icon: Video, label: 'TikTok', color: 'text-black' },
      { type: EntityType.SocialProfile, preset: 'YouTube', icon: Youtube, label: 'YouTube', color: 'text-red-600' },
    ]
  }
];

export default memo(function EntityPalette() {
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  // Check if any items match for empty state
  const hasResults = ENTITY_GROUPS.some(group => 
    group.items.some(entity => entity.label.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleDragStart = (e: React.DragEvent, entityType: EntityType, preset?: string) => {
    e.dataTransfer.setData('entityType', entityType);
    if (preset) e.dataTransfer.setData('entityPreset', preset);
  };

  if (collapsed) {
    return (
      <div className="w-10 border-r border-border bg-card/50 flex flex-col items-center py-3 shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className="p-2 hover:bg-accent rounded-none border border-transparent hover:border-border transition-all text-slate-600 hover:text-sky-400"
          title="Expand palette"
        >
          <Globe className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-56 border-r border-border bg-card/60 backdrop-blur-sm flex flex-col animate-slide-in-left shrink-0">
      {/* Header */}
      <div className="h-10 px-3 border-b border-border flex items-center justify-between shrink-0">
        <span className="text-[9px] font-semibold text-slate-600 uppercase tracking-widest font-mono">Entities</span>
        <button
          onClick={() => setCollapsed(true)}
          className="text-slate-700 hover:text-slate-400 transition-colors text-sm leading-none p-1"
        >
          ✕
        </button>
      </div>

      {/* Search */}
      <div className="px-2.5 py-2 border-b border-border shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600" />
          <input
            type="text"
            placeholder="Filter..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-6 pr-2.5 py-1.5 bg-background border border-border rounded-none text-xs text-slate-300 placeholder-slate-700 focus:outline-none focus:border-sky-400/40 focus:ring-0 transition-all font-mono"
          />
        </div>
      </div>

      {/* Entity List */}
      <div className="flex-1 overflow-y-auto py-1.5">
        {ENTITY_GROUPS.map((group) => {
          const visibleItems = group.items.filter(entity =>
            entity.label.toLowerCase().includes(searchQuery.toLowerCase())
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.title} className="mb-1">
              <div className="px-3 py-1 flex items-center gap-2">
                <span className="text-[9px] font-semibold text-slate-700 uppercase tracking-widest font-mono whitespace-nowrap">{group.title}</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="px-1.5 space-y-px">
                {visibleItems.map((entity) => {
                  const Icon = entity.icon;
                  return (
                    <div
                      key={`${entity.type}-${(entity as any).preset || 'default'}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, entity.type, (entity as any).preset)}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-none hover:bg-accent/60 cursor-move transition-all group border border-transparent hover:border-border/60"
                    >
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${entity.color}`} />
                      <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors truncate">{entity.label}</span>
                      <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-[8px] text-slate-700 font-mono shrink-0">⠿</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {!hasResults && (
          <div className="px-3 py-8 text-center text-[10px] text-slate-700 font-mono">no results</div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border shrink-0">
        <p className="text-[9px] text-slate-700 font-mono text-center">drag to canvas</p>
      </div>
    </div>
  );
});
