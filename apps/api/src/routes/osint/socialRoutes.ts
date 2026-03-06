import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const socialPlatforms = [
  { name: 'Twitter/X', url: 'https://twitter.com/', icon: '𝕏' },
  { name: 'GitHub', url: 'https://github.com/', icon: '💻' },
  { name: 'Instagram', url: 'https://instagram.com/', icon: '📷' },
  { name: 'LinkedIn', url: 'https://linkedin.com/in/', icon: '💼' },
  { name: 'Reddit', url: 'https://reddit.com/user/', icon: '🤖' },
  { name: 'YouTube', url: 'https://youtube.com/@', icon: '📺' },
  { name: 'TikTok', url: 'https://tiktok.com/@', icon: '🎵' },
  { name: 'Facebook', url: 'https://facebook.com/', icon: '👥' },
  { name: 'Medium', url: 'https://medium.com/@', icon: '📝' },
  { name: 'Telegram', url: 'https://t.me/', icon: '✈️' },
  { name: 'Discord', url: 'https://discord.com/users/', icon: '💬' },
  { name: 'VK', url: 'https://vk.com/', icon: '🔵' },
  { name: 'Patreon', url: 'https://patreon.com/', icon: '🎨' },
];

// Username search across social platforms
router.post('/username-search', async (req, res, next) => {
  try {
    const { username } = req.body;
    if (!username) throw new Error('Username is required');
    
    const results = socialPlatforms.slice(0, 5).map(platform => ({
        id: uuidv4(),
        type: 'social_profile',
        value: `${platform.icon} ${platform.name}: ${username}`,
        properties: { platform: platform.name, username: username, url: platform.url + username },
        link: { label: `possible ${platform.name} profile` },
    }));
    
    res.json({ success: true, data: { results } });
  } catch (error) {
    next(error);
  }
});

// Email to social profiles
router.post('/email-to-social', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) throw new Error('Email is required');
    
    const username = email.split('@')[0];
    const platforms = [
      { name: 'Gravatar', url: `https://gravatar.com/${email}` },
      { name: 'GitHub', url: `https://github.com/${username}` },
      { name: 'LinkedIn', url: `https://linkedin.com/in/${username}` },
    ];
    
    const results = platforms.map(p => ({
        id: uuidv4(),
        type: 'social_profile',
        value: `${p.name}: ${username}`,
        properties: { platform: p.name, email: email, url: p.url },
        link: { label: `possible ${p.name}` },
    }));
    
    res.json({ success: true, data: { results } });
  } catch (error) {
    next(error);
  }
});

export default router;
