/**
 * GitHub Service
 * 
 * Search GitHub for users, repositories, code, and commits.
 * Useful for OSINT on developers, leaked credentials, exposed secrets.
 * 
 * API Documentation: https://docs.github.com/en/rest
 * Free Tier: 60 requests/hour (unauthenticated), 5000/hour (authenticated)
 * API Key: GitHub Personal Access Token (optional but recommended)
 * 
 * Features:
 * - User profile search
 * - Repository search
 * - Code search (leaked API keys, secrets)
 * - Email discovery from commits
 */

interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  name: string;
  company?: string;
  blog?: string;
  location?: string;
  email?: string;
  bio?: string;
  twitter_username?: string;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
}

interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  private: boolean;
  fork: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  language: string;
  forks_count: number;
  topics: string[];
}

interface GitHubCodeResult {
  name: string;
  path: string;
  sha: string;
  url: string;
  html_url: string;
  repository: {
    full_name: string;
    html_url: string;
  };
}

export class GitHubService {
  private apiKey?: string;
  private baseUrl = 'https://api.github.com';

  constructor() {
    this.apiKey = process.env.GITHUB_API_KEY;
  }

  isConfigured(): boolean {
    return true; // Works without API key, but with rate limits
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json'
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  /**
   * Get user information
   */
  async getUser(username: string): Promise<GitHubUser | null> {
    try {
      const response = await fetch(`${this.baseUrl}/users/${username}`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`GitHub API error: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('GitHub user lookup failed:', error.message);
      return null;
    }
  }

  /**
   * Search repositories by query
   */
  async searchRepositories(query: string, limit: number = 10): Promise<GitHubRepository[] | null> {
    try {
      const params = new URLSearchParams({
        q: query,
        per_page: limit.toString(),
        sort: 'stars',
        order: 'desc'
      });

      const response = await fetch(`${this.baseUrl}/search/repositories?${params}`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = await response.json();
      return data.items || [];
    } catch (error: any) {
      console.error('GitHub repository search failed:', error.message);
      return null;
    }
  }

  /**
   * Search code for secrets (API keys, passwords, etc.)
   */
  async searchCode(query: string, limit: number = 5): Promise<GitHubCodeResult[] | null> {
    try {
      const params = new URLSearchParams({
        q: query,
        per_page: limit.toString()
      });

      const response = await fetch(`${this.baseUrl}/search/code?${params}`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = await response.json();
      return data.items || [];
    } catch (error: any) {
      console.error('GitHub code search failed:', error.message);
      return null;
    }
  }

  /**
   * Search for email in code/commits
   */
  async searchEmail(email: string): Promise<GitHubCodeResult[] | null> {
    return this.searchCode(`"${email}"`);
  }

  /**
   * Convert user to graph entities
   */
  convertUserToEntities(user: GitHubUser): { entities: any[], links: any[] } {
    const entities: any[] = [];
    const links: any[] = [];

    // Person entity
    const personId = `person-github-${user.login}-${Date.now()}`;
    entities.push({
      id: personId,
      type: 'person',
      value: user.name || user.login,
      data: {
        label: user.name || user.login,
        type: 'person',
        color: '#3b82f6'
      },
      properties: {
        github_username: user.login,
        github_id: user.id,
        bio: user.bio,
        location: user.location,
        company: user.company,
        blog: user.blog,
        twitter: user.twitter_username,
        repos: user.public_repos,
        followers: user.followers,
        following: user.following,
        created_at: user.created_at,
        avatar: user.avatar_url,
        profile_url: user.html_url
      }
    });

    // Email entity (if available)
    if (user.email) {
      const emailId = `email-${user.email}`;
      entities.push({
        id: emailId,
        type: 'email_address',
        value: user.email,
        data: {
          label: user.email,
          type: 'email_address',
          color: '#f59e0b'
        },
        properties: {
          source: 'GitHub Profile'
        }
      });

      links.push({
        id: `link-${personId}-${emailId}`,
        source: personId,
        target: emailId,
        label: 'uses'
      });
    }

    // Website entity (if blog exists)
    if (user.blog) {
      const websiteId = `website-${user.blog}-${Date.now()}`;
      entities.push({
        id: websiteId,
        type: 'url',
        value: user.blog,
        data: {
          label: user.blog,
          type: 'url',
          color: '#8b5cf6'
        },
        properties: {
          source: 'GitHub Profile'
        }
      });

      links.push({
        id: `link-${personId}-${websiteId}`,
        source: personId,
        target: websiteId,
        label: 'website'
      });
    }

    // Company entity (if exists)
    if (user.company) {
      const companyId = `org-${user.company.replace(/[@\s]/g, '-')}-${Date.now()}`;
      entities.push({
        id: companyId,
        type: 'organization',
        value: user.company,
        data: {
          label: user.company,
          type: 'organization',
          color: '#10b981'
        },
        properties: {
          source: 'GitHub Profile'
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

  /**
   * Convert code search results to leak entities
   */
  convertCodeSearchToEntities(results: GitHubCodeResult[], searchQuery: string): { entities: any[], links: any[] } {
    const entities: any[] = [];
    const links: any[] = [];

    results.forEach((result, idx) => {
      const leakId = `leak-github-${result.sha}-${Date.now()}-${idx}`;
      
      entities.push({
        id: leakId,
        type: 'data_leak',
        value: result.name,
        data: {
          label: `Leak: ${result.repository.full_name}/${result.path}`,
          type: 'data_leak',
          color: '#ef4444'
        },
        properties: {
          source: 'GitHub Code Search',
          repository: result.repository.full_name,
          path: result.path,
          filename: result.name,
          url: result.html_url,
          repo_url: result.repository.html_url,
          search_query: searchQuery
        }
      });

      // Link to repository owner (username entity)
      const ownerName = result.repository.full_name.split('/')[0];
      const ownerId = `username-${ownerName}`;
      
      links.push({
        id: `link-${leakId}-${ownerId}`,
        source: leakId,
        target: ownerId,
        label: 'owned by'
      });
    });

    return { entities, links };
  }

  /**
   * Convert repositories to entities
   */
  convertReposToEntities(repos: GitHubRepository[]): { entities: any[], links: any[] } {
    const entities: any[] = [];
    const links: any[] = [];

    repos.forEach((repo, idx) => {
      const repoId = `repo-${repo.id}-${Date.now()}-${idx}`;
      
      entities.push({
        id: repoId,
        type: 'repository',
        value: repo.full_name,
        data: {
          label: repo.full_name,
          type: 'repository',
          color: '#8b5cf6'
        },
        properties: {
          name: repo.name,
          description: repo.description,
          language: repo.language,
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          topics: repo.topics,
          created: repo.created_at,
          updated: repo.updated_at,
          url: repo.html_url,
          private: repo.private
        }
      });

      // Link to owner
      const ownerId = `username-${repo.owner.login}`;
      links.push({
        id: `link-${ownerId}-${repoId}`,
        source: ownerId,
        target: repoId,
        label: 'owns'
      });
    });

    return { entities, links };
  }
}

export const gitHubService = new GitHubService();
