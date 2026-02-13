# OSINT Services Documentation

## Overview

NodeWeaver includes **19+ integrated OSINT services** providing maximum intelligence coverage across breach data, threat intelligence, domain analysis, and people intelligence.

All services are implemented as **graph transforms** - they convert API results into graph entities and relationships for visual analysis.

---

## 🔓 Breach Intelligence (5 services)

### 1. **HaveIBeenPwned**
- **Purpose**: Check emails against 10+ billion breached accounts
- **API**: https://haveibeenpwned.com/
- **Cost**: ⚠️ Commercial tier required ($3.50/month)
- **Rate Limits**: Unlimited with API key
- **Transforms**:
  - `hibp_breach_check` - Email → Breaches + Pastes + Data Leaks
- **Output Entity Types**: `breach`, `data_leak`, `paste`
- **Properties**: Pwn count, breach date, data classes (Passwords, SSNs, etc.)

### 2. **BreachVIP** 
- **Purpose**: Comprehensive breach database search
- **API**: https://breachvip.com/
- **Cost**: ✅ 100% FREE (no API key required)
- **Transforms**:
  - `breachvip_email` - Email → Breaches
  - `breachvip_username` - Username → Breaches
  - `breachvip_phone` - Phone → Breaches
  - `breachvip_domain` - Domain → Emails + Breaches
  - `breachvip_ip` - IP → Breaches
- **Output Entity Types**: `breach`, `credentials`, `email_address`
- **Properties**: Source, breach date, exposed fields

### 3-5. **OathNet, Existing Services**
- See existing documentation

---

## 🛡️ Threat Intelligence (6 services)

### 1. **VirusTotal**
- **Purpose**: Multi-engine malware/threat scanning (70+ engines)
- **API**: https://developers.virustotal.com/
- **Cost**: ✅ Free tier (4 req/min, 500/day)
- **Rate Limits**: 4 requests/minute
- **Transforms**:
  - `virustotal_domain` - Domain → Threats + Categories
  - `virustotal_ip` - IP → Threats + Organization
  - `virustotal_url` - URL → Threats
- **Output Entity Types**: `threat`, `category`, `organization`
- **Properties**: Reputation score, malicious count, categories, tags

### 2. **AlienVault OTX**
- **Purpose**: Open Threat Exchange - community threat intel
- **API**: https://otx.alienvault.com/
- **Cost**: ✅ 100% FREE (optional API key for higher limits)
- **Transforms**:
  - `alienvault_domain` - Domain → Threat Pulses + Malware
  - `alienvault_ip` - IP → Threat Pulses + Reputation
- **Output Entity Types**: `threat_intel`, `malware`, `location`
- **Properties**: Pulse author, adversary, malware families, tags

### 3. **ThreatCrowd**
- **Purpose**: Threat intelligence aggregation
- **API**: https://threatcrowd.org/
- **Cost**: ✅ 100% FREE (no API key)
- **Transforms**:
  - `threatcrowd_domain` - Domain → IPs + Subdomains + Emails
  - `threatcrowd_ip` - IP → Domains + Malware Hashes
- **Output Entity Types**: `ip_address`, `subdomain`, `email_address`, `domain`, `file_hash`
- **Properties**: Vote count, last resolved timestamp

### 4. **GreyNoise**
- **Purpose**: Distinguish internet noise from targeted attacks
- **API**: https://docs.greynoise.io/
- **Cost**: ✅ Community API (no auth), Premium for full features
- **Transforms**:
  - `greynoise_ip` - IP → Classification (benign/malicious/unknown)
- **Output Entity Types**: `threat_intel`, `service`, `organization`
- **Properties**: RIOT status (known business service), classification, scanning ports

### 5. **AbuseIPDB**
- **Purpose**: Community IP abuse reporting database
- **API**: https://www.abuseipdb.com/
- **Cost**: ✅ Free tier (1000 req/day)
- **Transforms**:
  - `abuseipdb_check` - IP → Abuse Reports + Categories
- **Output Entity Types**: `threat_intel`, `organization`, `threat`
- **Properties**: Abuse confidence score (0-100%), report count, abuse categories (DDoS, scan, spam)

### 6. **Shodan** (Existing)
- See existing documentation

---

## 🌐 Domain Intelligence (4 services)

### 1. **Certificate Transparency (crt.sh)**
- **Purpose**: Subdomain enumeration via SSL certificate logs
- **API**: https://crt.sh/
- **Cost**: ✅ 100% FREE (no API key, no rate limits)
- **Transforms**:
  - `cert_transparency` - Domain → Subdomains + Certificate Authorities
- **Output Entity Types**: `subdomain`, `certificate_authority`
- **Properties**: Certificate issuers, issue dates, subdomain count
- **Value**: Finds subdomains even if DNS expired (historical certificates)

### 2. **Hunter.io**
- **Purpose**: Email finder and domain search
- **API**: https://hunter.io/
- **Cost**: ✅ Free tier (25 searches/month)
- **Transforms**:
  - `hunter_email_finder` - Domain → Emails + People
- **Output Entity Types**: `email_address`, `person`
- **Properties**: Confidence score, first/last name, position, department, email pattern

### 3. **WHOIS** (Existing)
- See existing documentation

### 4. **DNS Recon** (Existing)
- See existing documentation

---

## 🔒 Security Analysis (3 services)

### 1. **URLScan.io**
- **Purpose**: Website security scanner with screenshots
- **API**: https://urlscan.io/
- **Cost**: ✅ Free tier available
- **Transforms**:
  - `urlscan_website` - URL/Domain → IPs + Technologies + Threats
- **Output Entity Types**: `ip_address`, `technology`, `threat`
- **Properties**: Screenshot URL, malware verdict, tech stack, server info
- **Note**: Async scanning (10-30 second wait)

### 2. **PhishTank**
- **Purpose**: Community phishing URL database
- **API**: https://www.phishtank.com/
- **Cost**: ✅ FREE (optional API key for commercial use)
- **Transforms**:
  - `phishtank_url` - URL/Domain → Phishing Threats
- **Output Entity Types**: `threat`, `organization`, `ip_address`
- **Properties**: Verified status, online status, target brand, phish IPs

### 3. **Security Headers** (Existing)
- See existing documentation

---

## 👤 People Intelligence (2 services)

### 1. **GitHub**
- **Purpose**: Code search, user profiles, leaked secrets
- **API**: https://docs.github.com/en/rest
- **Cost**: ✅ FREE (60 req/hour unauthenticated, 5000 with token)
- **Transforms**:
  - `github_user` - Username → Person + Emails + Organization
  - `github_code_search` - Email/Domain → Code Leaks
- **Output Entity Types**: `person`, `email_address`, `url`, `organization`, `data_leak`
- **Properties**: Bio, location, company, repos, followers, leaked file paths

### 2. **Clearbit**
- **Purpose**: Person and company enrichment
- **API**: https://clearbit.com/
- **Cost**: ⚠️ 50 requests/month free (after trial)
- **Transforms**:
  - `clearbit_company` - Domain → Company + Contacts + Tech Stack
  - `clearbit_person` - Email → Person + Employment
- **Output Entity Types**: `organization`, `person`, `phone_number`, `email_address`, `technology`
- **Properties**: Employee count, revenue, industry, social profiles, job title, seniority

---

## 🌍 Geolocation (Existing)

- **IP Geolocation** - See existing documentation

---

## 📊 Summary Matrix

| Service | Cost | API Key | Rate Limit | Input Types | Output Types |
|---------|------|---------|------------|-------------|--------------|
| **HaveIBeenPwned** | 💰 Paid | Required | Unlimited | Email | Breach, Data Leak, Paste |
| **BreachVIP** | ✅ Free | ❌ None | Unknown | Email, Username, Phone, IP, Domain | Breach, Credentials |
| **VirusTotal** | ✅ Free | Required | 4/min, 500/day | Domain, IP, URL | Threat, Category, Organization |
| **AlienVault OTX** | ✅ Free | Optional | High | Domain, IP, URL, Hash | Threat Intel, Malware |
| **ThreatCrowd** | ✅ Free | ❌ None | Unknown | Domain, IP | IP, Subdomain, Email, Hash |
| **GreyNoise** | ✅ Free | Optional | Medium | IP | Threat Intel, Service |
| **AbuseIPDB** | ✅ Free | Required | 1000/day | IP | Threat Intel, Threat |
| **Certificate Transparency** | ✅ Free | ❌ None | ♾️ Unlimited | Domain | Subdomain, CA |
| **Hunter.io** | ✅ Free | Required | 25/month | Domain | Email, Person |
| **URLScan.io** | ✅ Free | Required | Medium | URL, Domain | IP, Technology, Threat |
| **PhishTank** | ✅ Free | Optional | Medium | URL, Domain | Threat, Organization, IP |
| **GitHub** | ✅ Free | Optional | 60/hr (5000 w/ key) | Username, Email, Domain | Person, Email, Data Leak |
| **Clearbit** | 💰 Freemium | Required | 50/month | Domain, Email | Organization, Person, Tech |

---

## 🚀 Usage Examples

### Example 1: Full Email Investigation
```
1. Add email entity: "john.doe@company.com"
2. Run transforms:
   - hibp_breach_check → Find breaches
   - breachvip_email → Cross-reference breaches
   - clearbit_person → Enrich with job title, company
   - github_code_search → Find code leaks
3. Result: Complete breach history + employment + leaked credentials
```

### Example 2: Domain Reconnaissance
```
1. Add domain entity: "targetcompany.com"
2. Run transforms:
   - cert_transparency → Find 50+ subdomains
   - hunter_email_finder → Find employees
   - virustotal_domain → Check reputation
   - clearbit_company → Get company intel
   - breachvip_domain → Find breached emails
3. Result: Attack surface map + employee list + breach exposure
```

### Example 3: IP Threat Analysis
```
1. Add IP entity: "192.168.1.1"
2. Run transforms:
   - virustotal_ip → Multi-engine scan
   - greynoise_ip → Classify noise vs attack
   - abuseipdb_check → Check abuse reports
   - alienvault_ip → Threat pulses
   - threatcrowd_ip → Associated domains
3. Result: Complete threat profile with verdict
```

---

## 🔑 API Key Setup Priority

### Essential (Tier 1)
1. **VirusTotal** - Core threat detection (free, 500/day)
2. **AbuseIPDB** - IP reputation (free, 1000/day)
3. **Hunter.io** - Email enumeration (free, 25/month)

### Recommended (Tier 2)
4. **GitHub Token** - Code search (free, 5000/hour)
5. **URLScan.io** - Website analysis (free tier)
6. **AlienVault OTX** - Better rate limits (free)
7. **GreyNoise** - Enhanced features (free community)

### Optional (Tier 3)
8. **HaveIBeenPwned** - Most comprehensive breach data ($3.50/month)
9. **Clearbit** - Best people/company enrichment (50/month free)
10. **PhishTank** - Commercial use (free for non-commercial)

---

## 🔮 Coming Soon

- **SecurityTrails** - Historical DNS/WHOIS
- **Censys** - IPv4 enumeration
- **BinaryEdge** - Internet scanning
- **FullContact** - Person enrichment
- **DNSDumpster** - DNS reconnaissance
- **Spyse** - Domain/IP intelligence
- **EmailRep** - Email reputation
- **Maltiverse** - IoC aggregation
- **BGPView** - ASN information
- **Archive.org** - Historical snapshots

---

## 📝 Notes

- All services return data as **graph entities**, not separate panels
- Transforms can be chained for multi-step investigations
- Rate limits are managed automatically (queuing, backoff)
- Free tiers are sufficient for most investigations
- Commercial tiers unlock unlimited usage for high-volume work

---

## 🆘 Support

For API key issues or service configuration:
1. Check `.env.example` for correct environment variable names
2. Verify API key validity at provider's website
3. Review rate limits in service documentation
4. Monitor API usage in provider dashboards
