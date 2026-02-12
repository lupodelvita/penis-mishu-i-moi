# Quick Start: Collaboration System Features

## What to Test

### 1. Real-time Collaboration (Existing)
```
✅ Open same graph in 2 tabs
✅ Add entity in tab 1 → See in tab 2
✅ Run transform → Toast shows result count
✅ Send chat message → Appears in both tabs
✅ See collaborator list with online status
```

### 2. Cursor Visualization (NEW)
```
✅ Open 2 browser windows
✅ Move mouse in one → See cursor in second window
✅ Cursor shows collaborator name + color
✅ Label follows cursor position
✅ Works across different browsers
```

### 3. Activity Timeline (NEW)
```
✅ Click CollaborationPanel
✅ Scroll "История действий" section
✅ See all actions with timestamps:
   ➕ add_entity → "Добавлена сущность"
   🔄 transform → "dns_lookup (5 результатов)"
   💬 chat → "Alice: Found new IPs"
   🔗 add_link → "Добавлена связь"
```

### 4. Persistent Command History (NEW)
```
✅ Add entities and run transforms in graph
✅ Close browser tab
✅ Reopen same graph
✅ Commands from before reload visible in timeline
✅ New real-time commands appear as users work
```

---

## Key URLs

**API Endpoint** (with auth header):
```
GET http://localhost:4000/api/graphs/GRAPH_ID/commands?limit=50
Authorization: Bearer JWT_TOKEN
```

**Socket.IO Events**:
```
Client → Server:
  join-graph { graphId, user }
  command { type, payload, userId }
  cursor-move { x, y }
  entity-select { entityId }

Server → Client:
  collaborators-update [users]
  command-received { command }
  cursor-update { userId, x, y }
  entity-select { userId, entityId }
```

---

## Database Inspection

```sql
-- Check all commands
SELECT id, type, "userName", timestamp FROM "GraphCommand" 
ORDER BY timestamp DESC LIMIT 10;

-- For specific graph
SELECT * FROM "GraphCommand" 
WHERE "graphId" = 'graph-xxxxx';

-- Count by type
SELECT type, COUNT(*) FROM "GraphCommand" GROUP BY type;

-- Size on disk
SELECT pg_size_pretty(pg_total_relation_size('GraphCommand'));
```

---

## Frontend Components

| Component | File | New Feature |
|-----------|------|-------------|
| CollaborationPanel | .../CollaborationPanel.tsx | Activity timeline with emoji + timestamps |
| GraphCanvasV2 | .../GraphCanvasV2.tsx | Collaborator cursors with labels |
| collaborationStore | .../collaborationStore.ts | loadHistoricalCommands() method |

---

## Backend Changes

| File | Change |
|------|--------|
| CollaborationService.ts | +persistCommand(), +getCommandHistory(), singleton |
| graphs.ts route | +GET /:id/commands endpoint |
| schema.prisma | +GraphCommand model + Graph.commands relation |
| migration | +20260212_add_graph_commands |

---

## Environment Setup

```bash
# Database migration
cd apps/api
npx prisma migrate deploy

# Requires:
DATABASE_URL=postgresql://user:pass@host/dbname
FRONTEND_URL=http://localhost:3000
```

---

## Feature Checklist

- [x] Real-time entity broadcasting
- [x] Real-time transform broadcasting  
- [x] Chat messaging system
- [x] Collaborator list with online status
- [x] **[NEW]** Collaborator cursor visualization
- [x] **[NEW]** Activity timeline with all command types
- [x] **[NEW]** Command persistence to PostgreSQL
- [x] **[NEW]** Command history loading on graph join
- [ ] Conflict resolution (Phase 3)
- [ ] Undo/redo with sync (Phase 3)
- [ ] Role-based permissions (Phase 3)

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Cursors not showing | Check Socket.IO connection status in CollaborationPanel |
| Timeline empty after refresh | Verify migration ran: `SELECT COUNT(*) FROM "GraphCommand"` |
| API 404 on /commands | Ensure JWT token in Authorization header |
| Timestamps wrong timezone | Check browser timezone settings + server time |
| Commands not persisting | Check database connection + migration status |
| Cursor labels too long | Names truncate, but color dot always visible |

---

## Files Modified

```
✏️  apps/api/src/services/CollaborationService.ts
✏️  apps/api/src/routes/graphs.ts
✏️  apps/api/prisma/schema.prisma
📄 apps/api/prisma/migrations/20260212_add_graph_commands/migration.sql

✏️  apps/web/src/store/collaborationStore.ts
✏️  apps/web/src/components/GraphCanvasV2.tsx
✏️  apps/web/src/components/CollaborationPanel.tsx

📄 COLLABORATION_PHASE2.md (NEW)
📄 IMPLEMENTATION_SUMMARY.md (NEW)
```

---

## Success Criteria

✅ All features implemented and tested
✅ No TypeScript compilation errors
✅ No runtime console errors
✅ Cursors render in real-time
✅ Timeline shows all command types
✅ Database migration successful
✅ Commands persist across sessions
✅ API endpoint returns data with auth
✅ Multiple users can collaborate simultaneously
✅ Production-ready code quality

---

Generated: 2026-02-12
Status: Ready for Deployment
