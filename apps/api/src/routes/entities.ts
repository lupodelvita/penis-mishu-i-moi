import { Router } from 'express';

const router = Router();

// Entity type definitions
const entityTypes = [
  { type: 'ip_address', label: 'IP Address', icon: '🌐', color: '#10b981' },
  { type: 'domain', label: 'Domain', icon: '🔗', color: '#3b82f6' },
  { type: 'email_address', label: 'Email', icon: '📧', color: '#8b5cf6' },
  { type: 'person', label: 'Person', icon: '👤', color: '#eab308' },
  { type: 'organization', label: 'Organization', icon: '🏢', color: '#f97316' },
  { type: 'location', label: 'Location', icon: '📍', color: '#ef4444' },
  { type: 'phone_number', label: 'Phone', icon: '📱', color: '#06b6d4' },
  { type: 'url', label: 'URL', icon: '🌍', color: '#6366f1' },
  { type: 'social_profile', label: 'Social Profile', icon: '👥', color: '#ec4899' },
  { type: 'username', label: 'Username', icon: '🏷️', color: '#14b8a6' },
  { type: 'bitcoin_address', label: 'Bitcoin Address', icon: '₿', color: '#f59e0b' },
  { type: 'document', label: 'Document', icon: '📄', color: '#64748b' },
];

// Get all entity types
router.get('/types', (_req, res) => {
  res.json({
    success: true,
    data: entityTypes,
  });
});

// Validate entity value
router.post('/validate', (req, res) => {
  const { type, value } = req.body;
  
  let isValid = false;
  let normalized = value;
  let message = '';
  
  switch (type) {
    case 'ip_address':
      // Simple IPv4 validation
      const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
      const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
      isValid = ipv4Regex.test(value) || ipv6Regex.test(value);
      if (ipv4Regex.test(value)) {
        const parts = value.split('.').map(Number);
        isValid = parts.every((p: number) => p >= 0 && p <= 255);
      }
      message = isValid ? 'Valid IP address' : 'Invalid IP address format';
      break;
      
    case 'domain':
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
      isValid = domainRegex.test(value);
      normalized = value.toLowerCase();
      message = isValid ? 'Valid domain' : 'Invalid domain format';
      break;
      
    case 'email_address':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      isValid = emailRegex.test(value);
      normalized = value.toLowerCase();
      message = isValid ? 'Valid email address' : 'Invalid email format';
      break;
      
    case 'phone_number':
      const phoneRegex = /^\+?[\d\s\-\(\)]{7,20}$/;
      isValid = phoneRegex.test(value);
      normalized = value.replace(/[\s\-\(\)]/g, '');
      message = isValid ? 'Valid phone number' : 'Invalid phone number format';
      break;
      
    case 'url':
      try {
        new URL(value);
        isValid = true;
        message = 'Valid URL';
      } catch {
        isValid = false;
        message = 'Invalid URL format';
      }
      break;
      
    default:
      isValid = value.length > 0;
      message = isValid ? 'Value accepted' : 'Value cannot be empty';
  }
  
  res.json({
    success: true,
    data: { isValid, normalized, message, type },
  });
});

export default router;
