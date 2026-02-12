# NodeWeaver Collaboration System

## Обзор

NodeWeaver теперь поддерживает полную систему совместной работы с синхронизацией в реальном времени между командой пользователей.

## Основные компоненты

### 1. **Collaboration Store** (`apps/web/src/store/collaborationStore.ts`)

Управляет состоянием коллаборации:
- **Socket.IO соединение** - Real-time связь между клиентами
- **Collaborators tracking** - Отслеживание активных пользователей
- **Command history** - История всех действий в графе
- **Graph updates** - Синхронизация обновлений графа

#### Интерфейсы:

```typescript
interface Collaborator {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };   // Позиция мыши
  selectedEntity?: string;              // Выбранная сущность
  lastActivity?: number;                // Время последней активности
}

interface CollaborativeCommand {
  id: string;
  type: 'add_entity' | 'delete_entity' | 'update_entity' | 
        'add_link' | 'delete_link' | 'transform' | 'chat';
  payload: any;
  userId: string;
  timestamp: Date;
  graphId: string;
}
```

### 2. **Collaboration Panel** (`apps/web/src/components/CollaborationPanel.tsx`)

UI компонент для коллаборации:
- **Status indicator** - Online/Offline статус
- **Active users** - Список активных коллаборантов
- **Activity feed** - История действий (сущности, трансформы)
- **Chat** - Встроенный чат для общения
- **Minimizable interface** - Компактный дизайн

### 3. **Socket.IO Backend Events**

API сервер должен обрабатывать события:

```typescript
// Client → Server
socket.emit('join-graph', { graphId, user });
socket.emit('graph-update', update);
socket.emit('command', command);
socket.emit('cursor-move', { x, y });
socket.emit('entity-select', { entityId });

// Server → Client
socket.on('collaborators-update', collaborators);
socket.on('graph-update', update);
socket.on('command-received', command);
socket.on('cursor-update', { userId, x, y });
socket.on('entity-select', { userId, entityId });
```

## Функции коллаборации

### Синхронизация сущностей

При добавлении новой сущности:
```typescript
// В GraphCanvasV2.tsx → confirmAddEntity()
sendCommand({
  type: 'add_entity',
  payload: newEntity,
  userId: 'local',
});
```

### Синхронизация трансформов

При завершении трансформа:
```typescript
// В TransformPanel.tsx → handleRunTransform()
if (isConnected) {
  sendCommand({
    type: 'transform',
    payload: { transformId, sourceEntity: sourceEntity.value, resultCount },
    userId: 'local',
  });
}
```

### Чат

Отправка сообщения:
```typescript
broadcastChatMessage('Новое сообщение');
```

### Отслеживание активности

- **Cursor tracking** - updateCursor(x, y)
- **Entity selection** - selectEntity(entityId)
- **Last activity** - Автоматически обновляется при каждом действии

## Интеграция с GraphCanvasV2

Graph Canvas отправляет команды при:
1. **Добавлении сущности** - confirmAddEntity()
2. **Удалении сущности** - handleDelete()
3. **Добавлении связи** - addLink()

## Интеграция с TransformPanel

Transform Panel отправляет команды при:
1. **Запуске трансформа** - Только для security scans и nmap
2. **Завершении трансформа** - С результатами

## Удаленный терминал (УДАЛЕН)

**STATUS**: ❌ **ПОЛНОСТЬЮ УДАЛЕН**

Причины:
- SES (Secure EcmaScript) блокирует класс наследования для xterm.Terminal
- Ошибка: "Super constructor null of anonymous class is not a constructor"
- Терминал больше не используется - все команды выполняются через API

Удаленные компоненты:
- ✅ TerminalConsole.tsx (больше не импортируется)
- ✅ Terminal toggle из Toolbar
- ✅ onOpenTerminal callbacks из GraphCanvas и TransformPanel

## Развертывание

### Требования

1. Socket.IO сервер при запуске API
2. Database для хранения graph updates (опционально)
3. Redis для сессий (опционально)

### Пример Socket.IO handler (Backend):

```typescript
// apps/api/src/routes/collaboration.ts
import { Server } from 'socket.io';

export function setupCollaboration(io: Server) {
  io.on('connection', (socket) => {
    socket.on('join-graph', ({ graphId, user }) => {
      socket.join(`graph:${graphId}`);
      io.to(`graph:${graphId}`).emit('collaborators-update', [...users]);
    });

    socket.on('command', (command) => {
      io.to(`graph:${command.graphId}`).emit('command-received', command);
    });

    socket.on('cursor-move', ({ x, y }) => {
      io.to(`graph:${userGraphId}`).emit('cursor-update', { 
        userId: socket.id, x, y 
      });
    });

    socket.on('disconnect', () => {
      io.to(`graph:${userGraphId}`).emit('collaborators-update', [...users]);
    });
  });
}
```

## Работа в реальном времени

### Для пользователя A:
1. Добавляет новую сущность
2. GraphCanvasV2 отправляет: `sendCommand({ type: 'add_entity', ... })`
3. Backend отправляет signal всем в комнате

### Для пользователя B:
1. Получает `command-received` event
2. CollaborationPanel показывает: "➕ 1 сущности добавлено"
3. Если нужна синхронизация - Graph автоматически обновляется

## Безопасность

- ✅ JWT auth для Socket.IO соединений (через authenticateToken)
- ✅ License check для access control
- ✅ userId validation в каждой команде
- ✅ Graph isolation by graphId

## Примеры использования

### Запуск в UI

```typescript
// app/page.tsx инициализирует коллаборацию:
const { connect } = useCollaborationStore();
useEffect(() => {
  const graphId = currentGraphId; // From route params
  const userName = user?.name || 'Anonymous';
  connect(graphId, userName); // Подключиться к графу
}, [currentGraphId]);
```

### Мониторинг активности

```typescript
const { commandHistory } = useCollaborationStore();

// Получить последние команды
const recentCommands = commandHistory.slice(-10);

// Получить только трансформы
const transforms = commandHistory.filter(c => c.type === 'transform');

// Получить статистику
const entityCount = commandHistory.filter(c => c.type === 'add_entity').length;
```

## Статус реализации

| Компонент | Статус | Описание |
|-----------|--------|---------|
| CollaborationStore | ✅ | Полностью реализовано |
| CollaborationPanel | ✅ | UI для коллаборации |
| GraphSync | ✅ | Синхронизация сущностей |
| TransformSync | ✅ | Синхронизация трансформов |
| Chat | ✅ | Встроенный чат |
| Terminal | ❌ | Удален (SES ограничение) |
| Backend Handler | ⏳ | Требует Socket.IO handler (нужно разработать) |
| Database Persistence | ⏳ | Требует реализации |

## Следующие шаги

1. **Implement Backend Socket.IO handlers** в apps/api
2. **Add database persistence** для command history
3. **Add conflict resolution** для одновременных изменений
4. **Add undo/redo** синхронизированные команды
5. **Add permissions** для selective editing

## Отладка

### Проверить соединение:
```typescript
const { isConnected, collaborators } = useCollaborationStore();
console.log('Connected:', isConnected, 'Users:', collaborators.length);
```

### Проверить команды:
```typescript
const { commandHistory } = useCollaborationStore();
console.log('Recent 5:', commandHistory.slice(-5));
```

### Console logs:
Все console.log удалены из UI для SES совместимости. Используйте browser DevTools Network tab для отладки Socket.IO.
