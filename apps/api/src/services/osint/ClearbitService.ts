/**
 * Clearbit Service
 * 
 * Person and company enrichment API. Find company info from domain,
 * and person info from email addresses.
 * 
 * API Documentation: https://clearbit.com/docs
 * Free Tier: 50 requests/month (after free trial)
 * API Key: https://clearbit.com/
 * 
 * Features:
 * - Company enrichment from domain
 * - Person enrichment from email
 * - Company logo, employee count, tech stack
 * - Person role, seniority, social profiles
 */

interface ClearbitCompany {
  id: string;
  name: string;
  legalName?: string;
  domain: string;
  url: string;
  site: {
    phoneNumbers: string[];
    emailAddresses: string[];
  };
  category: {
    sector: string;
    industryGroup: string;
    industry: string;
    subIndustry: string;
  };
  tags: string[];
  description: string;
  foundedYear: number;
  location: string;
  timeZone: string;
  utcOffset: number;
  geo: {
    streetNumber: string;
    streetName: string;
    subPremise: string;
    city: string;
    postalCode: string;
    state: string;
    stateCode: string;
    country: string;
    countryCode: string;
    lat: number;
    lng: number;
  };
  logo: string;
  facebook: { handle: string };
  linkedin: { handle: string };
  twitter: { handle: string; id: string; followers: number };
  crunchbase: { handle: string };
  emailProvider: boolean;
  type: string;
  ticker: string;
  phone: string;
  metrics: {
    alexaUsRank: number;
    alexaGlobalRank: number;
    employees: number;
    employeesRange: string;
    marketCap: number;
    raised: number;
    annualRevenue: number;
    estimatedAnnualRevenue: string;
    fiscalYearEnd: number;
  };
  tech: string[];
}

interface ClearbitPerson {
  id: string;
  name: {
    fullName: string;
    givenName: string;
    familyName: string;
  };
  email: string;
  location: string;
  timeZone: string;
  utcOffset: number;
  geo: {
    city: string;
    state: string;
    stateCode: string;
    country: string;
    countryCode: string;
    lat: number;
    lng: number;
  };
  bio: string;
  site: string;
  avatar: string;
  employment: {
    domain: string;
    name: string;
    title: string;
    role: string;
    subRole: string;
    seniority: string;
  };
  facebook: { handle: string };
  github: { handle: string; avatar: string; followers: number };
  twitter: { handle: string; followers: number };
  linkedin: { handle: string };
  googleplus: { handle: string };
  gravatar: { handle: string; avatar: string };
  fuzzy: boolean;
  emailProvider: boolean;
}

export class ClearbitService {
  private apiKey?: string;
  private companyUrl = 'https://company.clearbit.com/v2/companies/find';
  private personUrl = 'https://person.clearbit.com/v2/people/find';

  constructor() {
    this.apiKey = process.env.CLEARBIT_API_KEY;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Enrich company data from domain
   */
  async enrichCompany(domain: string): Promise<ClearbitCompany | null> {
    if (!this.apiKey) {
      throw new Error('Clearbit API key not configured');
    }

    try {
      const params = new URLSearchParams({ domain });
      
      const response = await fetch(`${this.companyUrl}?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Clearbit API error: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Clearbit company enrichment failed:', error.message);
      return null;
    }
  }

  /**
   * Enrich person data from email
   */
  async enrichPerson(email: string): Promise<ClearbitPerson | null> {
    if (!this.apiKey) {
      throw new Error('Clearbit API key not configured');
    }

    try {
      const params = new URLSearchParams({ email });
      
      const response = await fetch(`${this.personUrl}?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Clearbit API error: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Clearbit person enrichment failed:', error.message);
      return null;
    }
  }

  /**
   * Convert company to graph entities
   */
  convertCompanyToEntities(company: ClearbitCompany, domain: string): { entities: any[], links: any[] } {
    const entities: any[] = [];
    const links: any[] = [];

    // Main organization entity
    const orgId = `org-clearbit-${company.id}`;
    
    entities.push({
      id: orgId,
      type: 'organization',
      value: company.name,
      data: {
        label: company.name,
        type: 'organization',
        color: '#10b981'
      },
      properties: {
        legal_name: company.legalName,
        description: company.description,
        founded: company.foundedYear,
        employees: company.metrics?.employees,
        employee_range: company.metrics?.employeesRange,
        revenue: company.metrics?.estimatedAnnualRevenue,
        industry: company.category?.industry,
        sector: company.category?.sector,
        location: company.location,
        country: company.geo?.country,
        city: company.geo?.city,
        phone: company.phone,
        logo: company.logo,
        url: company.url,
        tags: company.tags
      },
      metadata: {
        twitter: company.twitter?.handle,
        linkedin: company.linkedin?.handle,
        facebook: company.facebook?.handle,
        crunchbase: company.crunchbase?.handle
      }
    });

    links.push({
      id: `link-domain-${orgId}`,
      source: `domain-${domain}`,
      target: orgId,
      label: 'organization'
    });

    // Phone entities
    if (company.site?.phoneNumbers && company.site.phoneNumbers.length > 0) {
      company.site.phoneNumbers.forEach((phone, idx) => {
        const phoneId = `phone-${phone.replace(/\D/g, '')}-${Date.now()}-${idx}`;
        entities.push({
          id: phoneId,
          type: 'phone_number',
          value: phone,
          data: {
            label: phone,
            type: 'phone_number',
            color: '#f59e0b'
          },
          properties: {
            source: 'Clearbit'
          }
        });

        links.push({
          id: `link-${orgId}-${phoneId}`,
          source: orgId,
          target: phoneId,
          label: 'phone'
        });
      });
    }

    // Email entities
    if (company.site?.emailAddresses && company.site.emailAddresses.length > 0) {
      company.site.emailAddresses.forEach((email, idx) => {
        const emailId = `email-${email}`;
        entities.push({
          id: emailId,
          type: 'email_address',
          value: email,
          data: {
            label: email,
            type: 'email_address',
            color: '#f59e0b'
          },
          properties: {
            source: 'Clearbit'
          }
        });

        links.push({
          id: `link-${orgId}-${emailId}`,
          source: orgId,
          target: emailId,
          label: 'email'
        });
      });
    }

    // Technology entities
    if (company.tech && company.tech.length > 0) {
      company.tech.slice(0, 10).forEach((tech, idx) => {
        const techId = `tech-${tech.replace(/\s+/g, '-')}-${Date.now()}-${idx}`;
        entities.push({
          id: techId,
          type: 'technology',
          value: tech,
          data: {
            label: tech,
            type: 'technology',
            color: '#8b5cf6'
          },
          properties: {
            source: 'Clearbit'
          }
        });

        links.push({
          id: `link-${orgId}-${techId}`,
          source: orgId,
          target: techId,
          label: 'uses'
        });
      });
    }

    return { entities, links };
  }

  /**
   * Convert person to graph entities
   */
  convertPersonToEntities(person: ClearbitPerson, email: string): { entities: any[], links: any[] } {
    const entities: any[] = [];
    const links: any[] = [];

    // Person entity
    const personId = `person-clearbit-${person.id}`;
    
    entities.push({
      id: personId,
      type: 'person',
      value: person.name.fullName,
      data: {
        label: person.name.fullName,
        type: 'person',
        color: '#3b82f6'
      },
      properties: {
        first_name: person.name.givenName,
        last_name: person.name.familyName,
        title: person.employment?.title,
        role: person.employment?.role,
        seniority: person.employment?.seniority,
        location: person.location,
        city: person.geo?.city,
        country: person.geo?.country,
        bio: person.bio,
        avatar: person.avatar,
        website: person.site
      },
      metadata: {
        twitter: person.twitter?.handle,
        github: person.github?.handle,
        linkedin: person.linkedin?.handle
      }
    });

    links.push({
      id: `link-email-${personId}`,
      source: `email-${email}`,
      target: personId,
      label: 'belongs to'
    });

    // Employment entity
    if (person.employment && person.employment.name) {
      const companyId = `org-${person.employment.domain}-${Date.now()}`;
      entities.push({
        id: companyId,
        type: 'organization',
        value: person.employment.name,
        data: {
          label: person.employment.name,
          type: 'organization',
          color: '#10b981'
        },
        properties: {
          domain: person.employment.domain
        }
      });

      links.push({
        id: `link-${personId}-${companyId}`,
        source: personId,
        target: companyId,
        label: 'works at'
      });
    }

    return { entities, links };
  }
}

export const clearbitService = new ClearbitService();
