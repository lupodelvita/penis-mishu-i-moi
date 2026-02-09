import axios from 'axios';
interface GeolocationData {
  lat: number;
  lon: number;
  country: string;
  regionName: string;
  city: string;
  zip?: string;
  isp?: string;
  org?: string;
  as?: string;
  query: string;
}
interface GeolocationResponse {
  status: 'success' | 'fail';
  message?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  regionName?: string;
  city?: string;
  zip?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  isp?: string;
  org?: string;
  as?: string;
  query?: string;
}
export class IpGeolocationService {
  private baseUrl = 'http://ip-api.com/json';
  async getLocation(ipAddress: string): Promise<GeolocationData | null> {
    try {
      if (!this.isValidIp(ipAddress)) {
        console.warn(`[IpGeolocation] Invalid IP address: ${ipAddress}`);
        return null;
      }
      const response = await axios.get<GeolocationResponse>(
        `${this.baseUrl}/${ipAddress}`,
        {
          params: {
            fields: 'status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query'
          },
          timeout: 5000
        }
      );
      if (response.data.status === 'fail') {
        console.warn(`[IpGeolocation] Failed to geolocate ${ipAddress}: ${response.data.message}`);
        return null;
      }
      return {
        lat: response.data.lat!,
        lon: response.data.lon!,
        country: response.data.country || 'Unknown',
        regionName: response.data.regionName || '',
        city: response.data.city || '',
        zip: response.data.zip,
        isp: response.data.isp,
        org: response.data.org,
        as: response.data.as,
        query: response.data.query || ipAddress
      };
    } catch (error) {
      console.error(`[IpGeolocation] Error fetching location for ${ipAddress}:`, error);
      return null;
    }
  }
  async getLocationsBatch(ipAddresses: string[]): Promise<Map<string, GeolocationData>> {
    const results = new Map<string, GeolocationData>();
    for (const ip of ipAddresses) {
      const result = await this.getLocation(ip);
      if (result) {
        results.set(ip, result);
      }
      if (ipAddresses.indexOf(ip) < ipAddresses.length - 1) {
        await this.delay(1500);
      }
    }
    return results;
  }
  private isValidIp(ip: string): boolean {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
export const ipGeolocationService = new IpGeolocationService();

