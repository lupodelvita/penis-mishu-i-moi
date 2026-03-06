import { Router } from 'express';
import { nmapService } from '../../services/osint/NmapService';
import { shodanService } from '../../services/osint/ShodanService';

const router = Router();

// Nmap port scanning
router.post('/nmap/scan', async (req, res, next) => {
  try {
    const { target, scanType = 'quick' } = req.body;
    
    if (!target) {
      return res.status(400).json({ 
        success: false, 
        error: 'Target (domain or IP) is required' 
      });
    }

    const validScanTypes = ['quick', 'full', 'vuln'];
    if (!validScanTypes.includes(scanType)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid scan type. Must be one of: ${validScanTypes.join(', ')}` 
      });
    }

    const scanResult = await nmapService.scan({ target, scanType });

    if (!scanResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: scanResult.error 
      });
    }

    const graphData = nmapService.convertToEntities(scanResult);

    res.json({
      success: true,
      data: {
        scan: {
          target: scanResult.target,
          scanType: scanResult.scanType,
          duration: scanResult.duration,
          startTime: scanResult.startTime,
          endTime: scanResult.endTime,
        },
        host: scanResult.host,
        results: graphData.entities,
        links: graphData.links
      },
    });
  } catch (error) {
    console.error('[Nmap] Scan error:', error);
    next(error);
  }
});

// Shodan Host Lookup
router.post('/shodan/host', async (req, res, _next) => {
  try {
    const { ip } = req.body;

    if (!ip) {
      return res.status(400).json({
        success: false,
        error: 'IP address is required'
      });
    }

    if (!shodanService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Shodan API key not configured'
      });
    }

    const hostInfo = await shodanService.getHostInfo(ip);

    if (!hostInfo) {
      return res.status(404).json({
        success: false,
        error: 'No information found for this IP'
      });
    }

    const graphData = shodanService.convertToEntities(hostInfo);

    return res.json({
      success: true,
      data: {
        host: hostInfo,
        results: graphData.entities,
        links: graphData.links
      }
    });
  } catch (error: any) {
    console.error('[Shodan] Host lookup error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to lookup host'
    });
  }
});

export default router;
