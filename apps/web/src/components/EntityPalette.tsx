'use client';

import { useState } from 'react';
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

export default function EntityPalette() {
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
      <div className="w-12 border-r border-border glass flex flex-col items-center py-4">
        <button
          onClick={() => setCollapsed(false)}
          className="p-2 hover:bg-accent rounded-md transition-colors"
        >
          <Globe className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 border-r border-border glass flex flex-col animate-slide-in-left">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Палитра</h2>
          <button
            onClick={() => setCollapsed(true)}
            className="p-1 hover:bg-accent rounded-md transition-colors text-muted-foreground"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Поиск..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Entity List */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-4">
          {ENTITY_GROUPS.map((group) => {
            const visibleItems = group.items.filter(entity => 
              entity.label.toLowerCase().includes(searchQuery.toLowerCase())
            );

            if (visibleItems.length === 0) return null;

            return (
              <div key={group.title}>
                <div className="text-xs font-semibold text-muted-foreground mb-2 px-2 uppercase tracking-wider opacity-70">
                  {group.title}
                </div>
                <div className="space-y-1">
                  {visibleItems.map((entity) => {
                    const Icon = entity.icon;
                    return (
                      <div
                        key={`${entity.type}-${(entity as any).preset || 'default'}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, entity.type, (entity as any).preset)}
                        className="flex items-center gap-3 p-3 rounded-md hover:bg-accent cursor-move transition-colors group"
                      >
                        <Icon className={`w-5 h-5 ${entity.color}`} />
                        <span className="text-sm font-medium">{entity.label}</span>
                        <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-xs text-muted-foreground">Drag</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {!hasResults && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Ничего не найдено
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <div className="text-xs text-muted-foreground text-center">
          Перетащите сущности на граф
        </div>
      </div>
    </div>
  );
}
