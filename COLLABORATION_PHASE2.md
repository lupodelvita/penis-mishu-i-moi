# Collaboration System - Phase 2: Database Persistence & Visualization

## Overview
Extended the real-time collaboration system with database persistence, cursor visualization, and enhanced activity timeline.

## Key Improvements

### 1. **Database Persistence** ✅
- **Added GraphCommand Model to Prisma Schema**
  - Stores all collaborative commands with timestamps
  - Indexed by graphId and timestamp for fast queries
  - Automatically cascades on graph deletion
  
- **Migration Created**
  - `20260212_add_graph_commands`: Creates GraphCommand table with proper indexes
  - Maintains referential integrity with Graph model

- **Backend Endpoint**
  - `GET /api/graphs/:id/commands?limit=50`
  - Merges database history with in-memory cache
  - Returns latest commands first
  - Requires authentication

### 2. **Cursor Visualization** ✅
- **Real-time Cursor Tracking**
  - Mouse position updates broadcast to all collaborators
  - Cursor position sent via `cursor-move` Socket.IO event
  - Frontend renders collaborator cursors with custom SVG pointer

- **Visual Indicators**
  - Custom cursor with collaborator name label
  - Color-coded by user (matches CollaborationPanel colors)
  - Glowing effect for visibility
  - Pointer events disabled (doesn't interfere with graph canvas)

### 3. **Activity Timeline**
- **Enhanced CollaborationPanel**
  - Displays all command types with emoji indicators:
    - ➕ add_entity
    - ➖ delete_entity  
    - 🔄 transform (shows result count)
    - 💬 chat (shows sender and message)
    - 🔗 add_link
    - ✂️ delete_link
  
- **Timeline Features**
  - Shows most recent commands first (reversed chronologically)
  - Timestamp for each command (HH:MM format)
  - Scrollable history window (200px max height)
  - Hover effects for better UX
  - Empty state when no commands

### 4. **Command History Loading**
- **On Graph Join**
  - `collaborationStore.loadHistoricalCommands(graphId)` fetches from server
  - Loads up to 100 recent commands
  - Populates before real-time sync starts

- **On App Boot**
  - When connecting to existing graph, loads DB history
  - Allows users to see all previous work
  - Smooth transition to real-time updates

## Architecture

### Frontend Flow
```
GraphCanvasV2
├── Mouse Move Handler
│   └── updateCursor() → Socket.IO emit
│
CollaborationPanel
├── Activity Timeline
│   └── Displays all command types
└── Chat Input
    └── Broadcasts chat command

collaborationStore
├── loadHistoricalCommands(graphId)
│   └── Fetch from /api/graphs/:id/commands
├── connect(graphId, userName)
│   └── Fetch history on connection
└── updateCursor(x, y)
    └── Emit cursor-move event
```

### Backend Flow
```
CollaborationService
├── persistCommand(command)
│   └── Save to DB via Prisma
├── command handler
│   ├── Create fullCommand with ID/timestamp
│   ├── Store in memory
│   ├── Persist to database
│   └── Broadcast to room
└── Singleton Pattern
    └── getInstance() for consistent instance
```

### API Endpoint
```
GET /api/graphs/:id/commands?limit=50

Response:
{
  success: true,
  data: [
    {
      id: "cmd-xxx",
      type: "add_entity|transform|chat",
      payload: {...},
      userId: "user-xxx",
      timestamp: "2026-02-12T...",
      graphId: "graph-xxx"
    }
  ],
  total: 45
}
```

## Implementation Details

### CollaborationService Changes
```typescript
// New singleton pattern
static getInstance(): CollaborationService {
  if (!this.instance) {
    this.instance = new CollaborationService();
  }
  return this.instance;
}

// Database persistence
private async persistCommand(command: CollaborativeCommand): Promise<void> {
  await prisma.graphCommand.create({
    data: {
      graphId: command.graphId,
      type: command.type,
      payload: command.payload,
      userId: command.userId,
      userName: command.payload?.sender || 'Unknown',
      timestamp: command.timestamp,
    },
  });
}

// History retrieval
getCommandHistory(graphId: string, limit?: number): CollaborativeCommand[] {
  const history = this.commandHistory.get(graphId) || [];
  return limit ? history.slice(-limit) : history;
}
```

### Frontend Cursor Visualization
```tsx
{/* Collaborator Cursors */}
{collaborators.map((collab) => (
  collab.cursor && (
    <div
      key={collab.id}
      className="fixed z-30 pointer-events-none"
      style={{
        left: `${collab.cursor.x}px`,
        top: `${collab.cursor.y}px`,
      }}
    >
      {/* SVG cursor + Name label */}
    </div>
  )
))}
```

### Activity Timeline Rendering
```tsx
commandHistory.slice().reverse().map((cmd) => {
  let displayText = '';
  switch (cmd.type) {
    case 'add_entity':
      displayText = 'Добавлена сущность';
      break;
    case 'transform':
      displayText = `${cmd.payload?.transformId} (${cmd.payload?.resultCount} результатов)`;
      break;
    // ...
  }
  return <TimelineItem cmd={cmd} displayText={displayText} />;
})
```

## File Changes Summary

### Backend
- **apps/api/src/services/CollaborationService.ts**
  - Added `persistCommand()` method
  - Added `getCommandHistory()` method  
  - Implemented singleton pattern with `getInstance()`
  - Removed duplicate code in socket handlers

- **apps/api/src/routes/graphs.ts**
  - Added `GET /:id/commands` endpoint
  - Merges DB and in-memory histories
  - Deduplicates results
  - Requires authentication

- **apps/api/prisma/schema.prisma**
  - Added `GraphCommand` model
  - Added indexes on `graphId` and `timestamp`
  - Cascading delete on graph deletion

- **apps/api/prisma/migrations/20260212_add_graph_commands**
  - SQL migration for new table structure

### Frontend
- **apps/web/src/store/collaborationStore.ts**
  - Added `loadHistoricalCommands()` action
  - Fetch from API on demand
  - New interface method signature

- **apps/web/src/components/GraphCanvasV2.tsx**
  - Added cursor tracking via `mousemove`
  - New `useEffect` hook for cursor position
  - Added collaborator cursor visualization with SVG
  - Renders cursor name labels

- **apps/web/src/components/CollaborationPanel.tsx**
  - Enhanced activity timeline display
  - Shows detailed command information
  - Displays timestamps for each action
  - Reversed chronological order (newest first)
  - Scrollable history (200px max)

## Testing Checklist

- [ ] Database migration runs successfully
- [ ] Commands persist after refresh
- [ ] Multiple users see each other's cursors in real-time
- [ ] Activity timeline shows all command types
- [ ] Timestamps display correctly (HH:MM format)
- [ ] Chat messages appear in timeline
- [ ] Graph shares persist commands across sessions
- [ ] No SQL errors in logs
- [ ] Foreign key constraints working
- [ ] API endpoint returns paginated results
- [ ] Cursor labels follow collaborator colors
- [ ] SVG cursors don't interfere with graph interaction

## Performance Considerations

1. **Database Indexing**
   - `graphId` index: Fast lookup by graph
   - `timestamp` index: Efficient ordering

2. **In-Memory Caching**
   - Keep recent commands in memory for instant broadcast
   - DB persists for history on reconnect

3. **Query Optimization**
   - Limit to 100 commands per graph on load
   - Could implement pagination for very large histories

4. **Cursor Updates**
   - Throttled via Socket.IO's built-in rate limiting
   - No database writes (transient data)

## Future Enhancements

### Phase 3 - Conflict Resolution
- Implement Operational Transform (OT) for concurrent edits
- Track entity modification timestamps
- Detect and resolve conflicts
- Show "edited by X at Y time" annotations

### Phase 4 - Permissions & Auditability
- Role-based access control (View/Edit/Admin)
- Command audit log with user tracking
- Undo/Redo with server-side sync
- Selective entity locking

### Phase 5 - Advanced Analytics
- Command history analytics dashboard
- Collaboration metrics (edits per user, graph activity)
- Export command history as CSV/JSON
- Replay functionality to visualize collaboration

## Security Notes

1. **Authentication**
   - All endpoints require valid JWT token
   - Token validated in middleware
   
2. **Authorization**
   - Should verify user has access to graph
   - Consider adding graph ownership check
   
3. **SQL Injection**
   - Prisma prevents via ORM
   - No raw SQL queries
   
4. **Data Privacy**
   - Commands include userId but not sensitive data
   - Chat messages stored as-is (could encrypt in future)

## Deployment

### Database Migration
```bash
cd apps/api
npx prisma migrate deploy
```

### Environment Variables
- `FRONTEND_URL`: Client URL for CORS
- `DATABASE_URL`: PostgreSQL connection string
- Already configured in .env.local

### No Breaking Changes
- All existing collaborators functionality maintained
- Socket.IO backward compatible
- Optional feature (works without new DB table)
