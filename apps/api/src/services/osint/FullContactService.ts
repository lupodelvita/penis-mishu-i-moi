/**
 * FullContact Service
 * 
 * Person and company data enrichment from email, phone, or social profiles.
 * 
 * API Documentation: https://docs.fullcontact.com/
 * Free Tier: 100 matches/month
 * API Key: https://dashboard.fullcontact.com/register (free registration)
 * 
 * Features:
 * - Person enrichment from email
 * - Company enrichment from domain
 * - Social profile resolution
 * - Name, photo, location, employment data
 * - Multi-identifier matching
 */

interface FullContactPerson {
  fullName?: string;
  ageRange?: string;
  gender?: string;
  location?: string;
  title?: string;
  organization?: string;
  linkedin?: string;
  twitter?: string;
  facebook?: string;
  bio?: string;
  avatar?: string;
  details?: {
    name?: {
      given?: string;
      family?: string;
    };
    age?: {
      range?: string;
    };
    gender?: string;
    demographics?: {
      locationDeduced?: {
        normalizedLocation?: string;
        city?: string;
        state?: string;
        country?: string;
      };
    };
    photos?: Array<{ url: string; type?: string }>;
    profiles?: Record<string, {
      url: string;
      username?: string;
      bio?: string;
      followers?: number;
      following?: number;
    }>;
    employment?: Array<{
      name: string;
      title?: string;
      current?: boolean;
      domain?: string;
    }>;
    urls?: Array<{ url: string; type?: string }>;
    emails?: Array<{ value: string; type?: string }>;
    phones?: Array<{ value: string; type?: string }>;
  };
}

interface FullContactCompany {
  name?: string;
  location?: string;
  twitter?: string;
  linkedin?: string;
  facebook?: string;
  bio?: string;
  logo?: string;
  website?: string;
  founded?: number;
  employees?: number;
  locale?: string;
  category?: string;
  details?: {
    entity?: {
      name?: string;
      founded?: number;
      employees?: number;
    };
    locales?: Array<{ code: string; name: string }>;
    categories?: Array<{ code: string; name: string }>;
    industries?: Array<{ code: string; name: string; type?: string }>;
    phones?: Array<{ value: string }>;
    emails?: Array<{ value: string; type?: string }>;
    profiles?: Record<string, { url: string; username?: string }>;
    urls?: Array<{ url: string; label?: string }>;
    images?: Array<{ url: string; label?: string }>;
    keywords?: string[];
    traffic?: {
      countryRank?: Record<string, number>;
      localeRank?: Record<string, number>;
    };
  };
}

export class FullContactService {
  private apiKey?: string;
  private baseUrl = 'https://api.fullcontact.com/v3';

  constructor() {
    this.apiKey = process.env.FULLCONTACT_API_KEY;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Enrich person from email
   */
  async enrichPerson(email: string): Promise<FullContactPerson | null> {
    if (!this.apiKey) throw new Error('FullContact API key not configured');

    try {
      const response = await fetch(`${this.baseUrl}/person.enrich`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 422) return null;
        throw new Error(`FullContact API error: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('FullContact person enrichment failed:', error.message);
      return null;
    }
  }

  /**
   * Enrich person from phone
   */
  async enrichPersonByPhone(phone: string): Promise<FullContactPerson | null> {
    if (!this.apiKey) throw new Error('FullContact API key not configured');

    try {
      const response = await fetch(`${this.baseUrl}/person.enrich`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phone })
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 422) return null;
        throw new Error(`FullContact API error: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('FullContact person by phone failed:', error.message);
      return null;
    }
  }

  /**
   * Enrich company from domain
   */
  async enrichCompany(domain: string): Promise<FullContactCompany | null> {
    if (!this.apiKey) throw new Error('FullContact API key not configured');

    try {
      const response = await fetch(`${this.baseUrl}/company.enrich`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ domain })
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 422) return null;
        throw new Error(`FullContact API error: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('FullContact company enrichment failed:', error.message);
      return null;
    }
  }

  /**
   * Convert person data to graph entities
   */
  convertPersonToEntities(person: FullContactPerson, sourceValue: string): { entities: any[]; links: any[] } {
    const entities: any[] = [];
    const links: any[] = [];
    const seen = new Set<string>();

    // Person entity
    if (person.fullName || person.details?.name) {
      const name = person.fullName || `${person.details?.name?.given || ''} ${person.details?.name?.family || ''}`.trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        entities.push({
          type: 'person',
          value: name,
          properties: {
            source: 'FullContact',
            age_range: person.ageRange || person.details?.age?.range,
            gender: person.gender || person.details?.gender,
            bio: person.bio,
            avatar: person.avatar || person.details?.photos?.[0]?.url
          },
          link: { label: 'identified as' }
        });
      }
    }

    // Organization / Employment
    if (person.organization) {
      if (!seen.has(person.organization)) {
        seen.add(person.organization);
        entities.push({
          type: 'organization',
          value: person.organization,
          properties: { source: 'FullContact', title: person.title },
          link: { label: 'works at' }
        });
      }
    }
    if (person.details?.employment) {
      for (const job of person.details.employment.filter(e => e.current).slice(0, 5)) {
        if (!seen.has(job.name)) {
          seen.add(job.name);
          entities.push({
            type: 'organization',
            value: job.name,
            properties: { source: 'FullContact', title: job.title, domain: job.domain },
            link: { label: 'employed at' }
          });
        }
      }
    }

    // Location
    if (person.location) {
      if (!seen.has(person.location)) {
        seen.add(person.location);
        entities.push({
          type: 'location',
          value: person.location,
          properties: { source: 'FullContact' },
          link: { label: 'located in' }
        });
      }
    }

    // Social profiles
    if (person.details?.profiles) {
      for (const [platform, profile] of Object.entries(person.details.profiles).slice(0, 10)) {
        const key = `${platform}:${profile.username || profile.url}`;
        if (!seen.has(key)) {
          seen.add(key);
          entities.push({
            type: 'social_profile',
            value: profile.url,
            data: { label: `${platform}: ${profile.username || profile.url}` },
            properties: {
              source: 'FullContact',
              platform,
              username: profile.username,
              followers: profile.followers,
              bio: profile.bio
            },
            link: { label: `${platform} profile` }
          });
        }
      }
    }

    // Twitter/LinkedIn shortcuts
    if (person.linkedin && !seen.has(`linkedin:${person.linkedin}`)) {
      seen.add(`linkedin:${person.linkedin}`);
      entities.push({
        type: 'social_profile',
        value: person.linkedin,
        data: { label: `LinkedIn: ${person.linkedin}` },
        properties: { source: 'FullContact', platform: 'linkedin' },
        link: { label: 'LinkedIn profile' }
      });
    }
    if (person.twitter && !seen.has(`twitter:${person.twitter}`)) {
      seen.add(`twitter:${person.twitter}`);
      entities.push({
        type: 'social_profile',
        value: person.twitter,
        data: { label: `Twitter: ${person.twitter}` },
        properties: { source: 'FullContact', platform: 'twitter' },
        link: { label: 'Twitter profile' }
      });
    }

    // Emails
    if (person.details?.emails) {
      for (const email of person.details.emails.slice(0, 5)) {
        if (!seen.has(email.value)) {
          seen.add(email.value);
          entities.push({
            type: 'email_address',
            value: email.value,
            properties: { source: 'FullContact', type: email.type },
            link: { label: 'email address' }
          });
        }
      }
    }

    // phones
    if (person.details?.phones) {
      for (const phone of person.details.phones.slice(0, 5)) {
        if (!seen.has(phone.value)) {
          seen.add(phone.value);
          entities.push({
            type: 'phone_number',
            value: phone.value,
            properties: { source: 'FullContact', type: phone.type },
            link: { label: 'phone number' }
          });
        }
      }
    }

    return { entities, links };
  }

  /**
   * Convert company data to graph entities
   */
  convertCompanyToEntities(company: FullContactCompany, sourceDomain: string): { entities: any[]; links: any[] } {
    const entities: any[] = [];
    const links: any[] = [];
    const seen = new Set<string>();

    // Organization entity
    if (company.name) {
      if (!seen.has(company.name)) {
        seen.add(company.name);
        entities.push({
          type: 'organization',
          value: company.name,
          properties: {
            source: 'FullContact',
            founded: company.founded || company.details?.entity?.founded,
            employees: company.employees || company.details?.entity?.employees,
            category: company.category,
            bio: company.bio,
            logo: company.logo
          },
          link: { label: 'organization' }
        });
      }
    }

    // Location
    if (company.location) {
      if (!seen.has(company.location)) {
        seen.add(company.location);
        entities.push({
          type: 'location',
          value: company.location,
          properties: { source: 'FullContact' },
          link: { label: 'headquarters' }
        });
      }
    }

    // Phones
    if (company.details?.phones) {
      for (const phone of company.details.phones.slice(0, 5)) {
        if (!seen.has(phone.value)) {
          seen.add(phone.value);
          entities.push({
            type: 'phone_number',
            value: phone.value,
            properties: { source: 'FullContact' },
            link: { label: 'company phone' }
          });
        }
      }
    }

    // Industry categories
    if (company.details?.industries) {
      for (const industry of company.details.industries.slice(0, 5)) {
        if (!seen.has(industry.name)) {
          seen.add(industry.name);
          entities.push({
            type: 'category',
            value: industry.name,
            properties: { source: 'FullContact', code: industry.code },
            link: { label: 'industry' }
          });
        }
      }
    }

    // Social profiles
    if (company.details?.profiles) {
      for (const [platform, profile] of Object.entries(company.details.profiles).slice(0, 5)) {
        const key = `${platform}:${profile.url}`;
        if (!seen.has(key)) {
          seen.add(key);
          entities.push({
            type: 'social_profile',
            value: profile.url,
            data: { label: `${platform}: ${profile.username || profile.url}` },
            properties: { source: 'FullContact', platform, username: profile.username },
            link: { label: `${platform} profile` }
          });
        }
      }
    }

    return { entities, links };
  }
}

export const fullContactService = new FullContactService();
