export interface GeoLocation {
  latitude: number;
  longitude: number;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  timezone?: string;
  isp?: string;
  org?: string;
  as?: string;
}

export class GeoLocationService {
  /**
   * Get geolocation data for an IP address using ip-api.com (free, no key needed)
   */
  async getLocationFromIP(ip: string): Promise<GeoLocation | null> {
    try {
      // Using ip-api.com - free, no API key required
      // Rate limit: 45 requests per minute
      const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,city,lat,lon,timezone,isp,org,as`);
      
      if (!response.ok) {
        throw new Error(`IP-API error: ${response.status}`);
      }

      const data = await response.json() as any;

      if (data.status === 'fail') {
        console.warn(`[GeoLocation] Failed to get location for ${ip}: ${data.message}`);
        return null;
      }

      return {
        latitude: data.lat,
        longitude: data.lon,
        city: data.city,
        region: data.region,
        country: data.country,
        countryCode: data.countryCode,
        timezone: data.timezone,
        isp: data.isp,
        org: data.org,
        as: data.as,
      };
    } catch (error) {
      console.error('[GeoLocation] Error fetching location:', error);
      return null;
    }
  }

  /**
   * Convert geolocation data to a location entity
   */
  ipToLocationEntity(ip: string, geoData: GeoLocation) {
    const locationId = `location-${ip.replace(/\./g, '-')}`;
    const ipId = `ip-${ip.replace(/\./g, '-')}`;

    const entities = [
      {
        id: locationId,
        type: 'location',
        value: `${geoData.city || 'Unknown'}, ${geoData.country || 'Unknown'}`,
        data: {
          label: `📍 ${geoData.city || 'Unknown'}, ${geoData.country || 'Unknown'}`,
          lat: geoData.latitude,
          lon: geoData.longitude,
          city: geoData.city,
          country: geoData.country,
          countryCode: geoData.countryCode,
          timezone: geoData.timezone,
          isp: geoData.isp,
          color: '#10b981', // green
        },
      },
    ];

    const links = [
      {
        id: `link-${ipId}-${locationId}`,
        source: ipId,
        target: locationId,
        label: 'located in',
      },
    ];

    return { entities, links };
  }

  /**
   * Batch IP geolocation (with rate limiting)
   */
  async batchGetLocations(ips: string[]): Promise<Map<string, GeoLocation>> {
    const results = new Map<string, GeoLocation>();
    
    // Process in small batches to respect rate limit (45/min for ip-api)
    const batchSize = 10;
    for (let i = 0; i < ips.length; i += batchSize) {
      const batch = ips.slice(i, i + batchSize);
      
      const batchResults = await Promise.allSettled(
        batch.map(ip => this.getLocationFromIP(ip))
      );

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          results.set(batch[index], result.value);
        }
      });

      // Wait 2 seconds between batches to avoid rate limiting
      if (i + batchSize < ips.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return results;
  }
}

export const geoLocationService = new GeoLocationService();
