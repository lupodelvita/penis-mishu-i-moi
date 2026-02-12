# BreachVIP Integration Guide

## Overview

BreachVIP is a powerful OSINT (Open Source Intelligence) service integrated into NodeWeaver for searching leaked data across multiple breach databases.

**Features:**
- Search across 10+ data fields (email, username, domain, phone, IP, etc.)
- Wildcard search support (* and ? operators)
- Support for multiple social platforms and services
- Rate-limited (15 requests per minute)
- Returns up to 10,000 results per query

## Setup

### 1. API Configuration

Add your BreachVIP API key to your environment variables:

**Backend (apps/api/.env):**
```env
BREACHVIP_API_KEY=your_api_key_here
```

**Frontend (apps/web/.env.local):**
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 2. API Base URL

If BreachVIP uses a different base URL, update it in:
`apps/api/src/services/osint/BreachVIPService.ts`

```typescript
private baseUrl = 'https://api.breachvip.com'; // Update this URL
```

## API Endpoints

All endpoints require authentication via Bearer token.

### Generic Search
**POST** `/api/osint/breachvip/search`

Request body:
```json
{
  "term": "search@example.com",
  "fields": ["email", "username"],
  "wildcard": false,
  "case_sensitive": false,
  "categories": null
}
```

### Quick Search Endpoints

**Email Search**
```
POST /api/osint/breachvip/email
Body: { "email": "user@example.com", "wildcard": false }
```

**Username Search**
```
POST /api/osint/breachvip/username
Body: { "username": "johndoe", "wildcard": true }
```

**Domain Search**
```
POST /api/osint/breachvip/domain
Body: { "domain": "example.com", "wildcard": false }
```

**IP Address Search**
```
POST /api/osint/breachvip/ip
Body: { "ip": "192.168.1.1" }
```

**Phone Search**
```
POST /api/osint/breachvip/phone
Body: { "phone": "+1234567890" }
```

**Multi-field Identity Search**
```
POST /api/osint/breachvip/identity
Body: { "term": "john", "wildcard": true }
```
Searches across: email, username, phone, name

**Rate Limit Status**
```
GET /api/osint/breachvip/status
```

## Response Format

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "source": "ExampleBreach2023",
        "categories": ["social", "gaming"],
        "email": "user@example.com",
        "username": "johndoe",
        "password": "hashed_password",
        "phone": "+1234567890"
      }
    ],
    "total": 1,
    "term": "user@example.com",
    "fields": ["email"]
  },
  "rateLimitStatus": {
    "used": 5,
    "limit": 15,
    "remaining": 10
  }
}
```

## Frontend Usage

### Using the BreachVIPPanel Component

```tsx
import BreachVIPPanel from '@/components/BreachVIPPanel';

function MyPage() {
  const handleDataFetched = (data) => {
    console.log('Breach results:', data);
    // Process results, add to graph, etc.
  };

  return (
    <div>
      <BreachVIPPanel onDataFetched={handleDataFetched} />
    </div>
  );
}
```

### Manual API Call

```typescript
const searchBreaches = async (term: string, fields: string[]) => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/osint/breachvip/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
    body: JSON.stringify({
      term,
      fields,
      wildcard: false,
      case_sensitive: false,
    }),
  });

  const data = await response.json();
  return data;
};
```

## Search Fields

Available fields for searching:
- `email` - Email addresses
- `username` - Usernames
- `domain` - Domain names
- `phone` - Phone numbers
- `ip` - IP addresses
- `name` - Full names
- `discordid` - Discord IDs
- `steamid` - Steam IDs
- `uuid` - UUIDs (Minecraft, etc.)
- `password` - Passwords (hashed or plain)

## Wildcard Operators

When `wildcard: true`:
- `*` matches zero or more characters
- `?` matches exactly one character

**Examples:**
- `c*s` matches: `cats`, `cars`, `cs`
- `c?t?` matches: `cats`, `cute`

**Restrictions:**
- Search terms cannot begin with `*` or `?`
- Wildcard queries may be slower

## Rate Limiting

- **Limit:** 15 requests per minute
- **Penalty:** Blocked for 1 minute if limit exceeded
- **Tracking:** Automatic with `getRateLimitStatus()`

Check status:
```bash
curl -X GET http://localhost:4000/api/osint/breachvip/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Error Handling

Common errors:

**503 Service Unavailable**
```json
{
  "success": false,
  "error": "BreachVIP API not configured. Set BREACHVIP_API_KEY environment variable."
}
```
**Solution:** Add API key to `.env`

**429 Rate Limited**
```json
{
  "success": false,
  "error": "Rate limit exceeded (15 requests per minute)"
}
```
**Solution:** Wait 1 minute before retrying

**400 Bad Request**
```json
{
  "success": false,
  "error": "Search term must be between 1-100 characters"
}
```
**Solution:** Check input validation

## Security Considerations

⚠️ **Important:**
- Never expose API keys in client-side code
- All searches are logged for security
- Breach data may contain sensitive information
- Implement proper access controls
- Consider rate limiting on frontend

## Integration with Graph Canvas

To add breach results to the graph:

```typescript
const addBreachToGraph = (result: any) => {
  // Create source node
  const sourceNode = {
    id: `breach-${Date.now()}`,
    type: 'database',
    value: result.source,
    properties: {
      categories: result.categories,
      breach: true,
    },
  };

  // Create data nodes (email, username, etc.)
  const dataNodes = Object.entries(result)
    .filter(([key]) => !['source', 'categories'].includes(key))
    .map(([key, value]) => ({
      id: `${key}-${Date.now()}`,
      type: key,
      value: String(value),
    }));

  // Add nodes and links to graph
  // ... your graph update logic
};
```

## Testing

Test the integration:

```bash
# Check if service is configured
curl http://localhost:4000/api/osint/breachvip/status

# Search by email
curl -X POST http://localhost:4000/api/osint/breachvip/email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"email":"test@example.com"}'
```

## Troubleshooting

**No results returned:**
- Check if API key is valid
- Verify search term format
- Try different fields
- Check rate limit status

**API not responding:**
- Verify `BREACHVIP_API_KEY` is set
- Check network connectivity
- Confirm base URL is correct

**Rate limit issues:**
- Implement client-side caching
- Add request queuing
- Display remaining requests to users

## Future Enhancements

Potential improvements:
- [ ] Add result caching (Redis)
- [ ] Implement request queue for rate limiting
- [ ] Export results to CSV/JSON
- [ ] Add breach timeline visualization
- [ ] Integrate with entity relationship graph
- [ ] Add notification for new breaches

## Support

For API issues, contact BreachVIP support or check their documentation at:
https://breachvip.com/api/docs
