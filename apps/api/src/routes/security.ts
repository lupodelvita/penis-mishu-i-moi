import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import net from 'net';
import { authenticateToken } from '../middleware/auth';
import { requireLicense } from '../middleware/license';

const router = Router();

router.use(authenticateToken);
router.use(requireLicense);

// Helper: TCP Port Checker
const checkPort = (host: string, port: number, timeout = 2000): Promise<boolean> => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let status = false;
    socket.setTimeout(timeout);
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
    socket.on('connect', () => { status = true; socket.destroy(); });
    socket.on('error', () => { socket.destroy(); resolve(false); });
    socket.on('close', () => { resolve(status); });
    socket.connect(port, host);
  });
};

async function fetchWithTimeout(url: string, timeout = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// 1. Port Scanner
router.post('/nmap-scan', async (req, res, next) => {
  try {
    const { target, scanType = 'quick' } = req.body;
    if (!target) throw new Error('Target required');

    const commonPorts = [21, 22, 23, 25, 53, 80, 110, 135, 139, 443, 445, 1433, 3306, 3389, 5432, 6379, 8000, 8080, 8443, 27017];
    const portsToScan = scanType === 'full' ? Array.from({length: 50}, (_, i) => i + 1) : commonPorts;

    const results: any[] = [];
    const openPorts: number[] = [];

    await Promise.all(portsToScan.map(async (port) => {
      if (await checkPort(target, port)) {
        openPorts.push(port);
        results.push({
          id: uuidv4(),
          type: 'port',
          value: `${port}/tcp`,
          properties: { port, state: 'open', protocol: 'tcp' },
          link: { label: `port ${port}` },
        });
      }
    }));
    
    if (openPorts.length > 0) {
        results.push({
            id: uuidv4(),
            type: 'scan_result',
            value: `Found ${openPorts.length} open ports`,
            properties: { ports: openPorts },
            link: { label: 'Scan Summary' }
        });
    }

    res.json({ success: true, data: { results, target } });
  } catch (error) {
    next(error);
  }
});

// 2. XSS Scanner
router.post('/xss-scan', async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) throw new Error('URL required');

    const results: any[] = [];
    const targetUrl = new URL(url);
    const params = Array.from(targetUrl.searchParams.keys());

    if (params.length === 0) {
      return res.json({ 
        success: true, 
        data: { 
          results: [],
          message: 'URL не содержит GET параметров для тестирования. Пример: http://example.com/page?param=value' 
        } 
      });
    }

    const payload = "<script>alert('NODEWEAVER_XSS')</script>";
    const checkString = "alert('NODEWEAVER_XSS')"; 

    for (const param of params) {
        const fuzzUrl = new URL(url);
        fuzzUrl.searchParams.set(param, payload);
        try {
            const response = await fetchWithTimeout(fuzzUrl.toString());
            const text = await response.text();
            if (text.includes(checkString)) {
                results.push({
                    id: uuidv4(),
                    type: 'vulnerability',
                    value: `Reflected XSS: ${param}`,
                    properties: { type: 'Reflected XSS', severity: 'high', parameter: param, payload, cwe: 'CWE-79' },
                    link: { label: 'XSS Found' }
                });
            }
        } catch (e) {}
    }

    res.json({ success: true, data: { results } });
  } catch (error) {
    next(error);
  }
});

// 3. SQLi Scanner
router.post('/sqli-scan', async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) throw new Error('URL required');

    const results: any[] = [];
    const params = Array.from(new URL(url).searchParams.keys());
    const sqlErrors = ["SQL syntax", "MySQL Error", "quoted string not properly terminated", "Unclosed quotation mark", "SQLSTATE"];

    if (params.length === 0) {
      return res.json({ 
        success: true, 
        data: { 
          results: [],
          message: 'URL не содержит GET параметров для тестирования. Пример: http://example.com/page?id=1' 
        } 
      });
    }

    for (const param of params) {
        const fuzzUrl = new URL(url);
        fuzzUrl.searchParams.set(param, "'");
        try {
            const response = await fetchWithTimeout(fuzzUrl.toString());
            const text = await response.text();
            const foundError = sqlErrors.find(err => text.includes(err));
            if (foundError) {
                results.push({
                    id: uuidv4(),
                    type: 'vulnerability',
                    value: `Possible SQLi: ${param}`,
                    properties: { type: 'Error-based SQLi', severity: 'critical', parameter: param, evidence: foundError, cwe: 'CWE-89' },
                    link: { label: 'SQLi Found' }
                });
            }
        } catch (e) {}
    }

    res.json({ success: true, data: { results } });
  } catch (error) {
    next(error);
  }
});

// 4. Test Vulnerable Page
router.get('/vulnerable', (req, res) => {
    const { q, id } = req.query;
    let html = `<h1>Vulnerable Test Page</h1><p>Params: ?q= (XSS), ?id= (SQLi)</p>`;
    if (q) html += `<p>Query: ${q}</p>`;
    if (id && String(id).includes("'")) {
        res.status(500).send(`SQL Error near '${id}'`);
        return;
    }
    res.send(html);
});

export default router;
