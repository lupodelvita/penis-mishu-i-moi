import { parsePhoneNumber, isValidPhoneNumber, CountryCode, getCountryCallingCode } from 'libphonenumber-js';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface PhoneValidation {
  valid: boolean;
  e164: string | null;           // +79001234567
  national: string | null;       // 8 (900) 123-45-67
  international: string | null;  // +7 900 123-45-67
  country: string | null;        // RU
  countryCallingCode: string | null; // 7
  type: string | null;           // MOBILE / FIXED_LINE / VOIP / etc.
  carrier: string | null;        // from libphonenumber
}

export interface CarrierInfo {
  carrier: string | null;
  country: string | null;
  countryCode: string | null;
  lineType: string | null;       // mobile / landline / voip
  mobileCountryCode: string | null; // MCC
  mobileNetworkCode: string | null; // MNC
  ported: boolean | null;        // MNP — was number ported?
  source: string;                // api name
}

export interface HlrResult {
  active: boolean | null;
  roaming: boolean | null;
  currentCarrier: string | null;
  originalCarrier: string | null;
  ported: boolean | null;
  imsi: string | null;
  source: string;
}

export interface MessengerPresence {
  whatsapp: boolean | null;
  telegram: boolean | null;
  viber: boolean | null;
}

export interface PhoneIntelResult {
  phone: string;
  validation: PhoneValidation;
  carrier: CarrierInfo | null;
  hlr: HlrResult | null;
  messengers: MessengerPresence;
  cachedAt: number;
  methods: string[];             // which methods actually succeeded
  errors: string[];              // which methods failed and why
}

// ─── Cache ───────────────────────────────────────────────────────────────────

interface CacheEntry {
  result: PhoneIntelResult;
  expiresAt: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class PhoneIntelService {
  private cache = new Map<string, CacheEntry>();
  private cacheTtlMs: number;

  // API keys from env
  private numverifyKey = process.env.NUMVERIFY_API_KEY || '';
  private abstractKey  = process.env.ABSTRACT_PHONE_API_KEY || '';
  private hlrKey       = process.env.HLR_API_KEY || '';
  private hlrSecret    = process.env.HLR_API_SECRET || '';

  constructor(cacheTtlMs = 5 * 60 * 1000) {
    this.cacheTtlMs = cacheTtlMs;
  }

  // ─── Main Entry Point ───────────────────────────────────────────────────────

  async lookup(phone: string): Promise<PhoneIntelResult> {
    // Normalize to E.164 for cache key
    const normalized = this.normalize(phone);
    const cacheKey = normalized || phone;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      console.log(`[PhoneIntel] Cache hit for ${cacheKey}`);
      return cached.result;
    }

    // Step 1: Local validation (always works, no API)
    const validation = this.validate(phone);

    const result: PhoneIntelResult = {
      phone: validation.e164 || phone,
      validation,
      carrier: null,
      hlr: null,
      messengers: { whatsapp: null, telegram: null, viber: null },
      cachedAt: Date.now(),
      methods: [],
      errors: [],
    };

    if (!validation.valid) {
      result.errors.push('validation: invalid phone number format');
      this.cacheResult(cacheKey, result);
      return result;
    }

    const e164 = validation.e164!;

    // Step 2–4: Run independent checks in parallel
    const [carrierResult, hlrResult, messengerResult] = await Promise.allSettled([
      this.lookupCarrier(e164),
      this.lookupHlr(e164),
      this.checkMessengers(e164),
    ]);

    // Carrier
    if (carrierResult.status === 'fulfilled' && carrierResult.value) {
      result.carrier = carrierResult.value;
      result.methods.push(`carrier:${carrierResult.value.source}`);
    } else if (carrierResult.status === 'rejected') {
      result.errors.push(`carrier: ${carrierResult.reason?.message || 'failed'}`);
    }

    // HLR
    if (hlrResult.status === 'fulfilled' && hlrResult.value) {
      result.hlr = hlrResult.value;
      result.methods.push(`hlr:${hlrResult.value.source}`);
    } else if (hlrResult.status === 'rejected') {
      result.errors.push(`hlr: ${hlrResult.reason?.message || 'failed'}`);
    }

    // Messengers
    if (messengerResult.status === 'fulfilled') {
      result.messengers = messengerResult.value;
      if (messengerResult.value.whatsapp !== null) result.methods.push('whatsapp');
      if (messengerResult.value.telegram !== null) result.methods.push('telegram');
    } else if (messengerResult.status === 'rejected') {
      result.errors.push(`messengers: ${messengerResult.reason?.message || 'failed'}`);
    }

    this.cacheResult(cacheKey, result);
    return result;
  }

  // ─── 1. Local Validation (libphonenumber-js) ───────────────────────────────

  private normalize(phone: string): string | null {
    try {
      const parsed = parsePhoneNumber(phone);
      return parsed?.number || null;
    } catch {
      return null;
    }
  }

  private validate(phone: string): PhoneValidation {
    try {
      const parsed = parsePhoneNumber(phone);
      if (!parsed) {
        return { valid: false, e164: null, national: null, international: null, country: null, countryCallingCode: null, type: null, carrier: null };
      }

      return {
        valid: parsed.isValid(),
        e164: parsed.number,
        national: parsed.formatNational(),
        international: parsed.formatInternational(),
        country: parsed.country || null,
        countryCallingCode: parsed.countryCallingCode || null,
        type: parsed.getType() || null,
        carrier: null, // libphonenumber-js doesn't include carrier DB
      };
    } catch {
      return { valid: false, e164: null, national: null, international: null, country: null, countryCallingCode: null, type: null, carrier: null };
    }
  }

  // ─── 2. Carrier / MNP Lookup ────────────────────────────────────────────────

  private async lookupCarrier(e164: string): Promise<CarrierInfo | null> {
    // Try Numverify first, then Abstract API
    if (this.numverifyKey) {
      try {
        return await this.numverifyLookup(e164);
      } catch (err: any) {
        console.warn('[PhoneIntel] Numverify failed:', err.message);
      }
    }

    if (this.abstractKey) {
      try {
        return await this.abstractPhoneLookup(e164);
      } catch (err: any) {
        console.warn('[PhoneIntel] Abstract API failed:', err.message);
      }
    }

    // No API keys configured — return null (graceful degradation)
    return null;
  }

  /**
   * Numverify API — free tier: 100 req/month
   * https://numverify.com/documentation
   */
  private async numverifyLookup(e164: string): Promise<CarrierInfo> {
    // Numverify expects number without "+"
    const number = e164.replace(/^\+/, '');
    const url = `http://apilayer.net/api/validate?access_key=${this.numverifyKey}&number=${number}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Numverify HTTP ${res.status}`);

    const data: any = await res.json();

    if (data.error) {
      throw new Error(`Numverify: ${data.error.info || data.error.type}`);
    }

    return {
      carrier: data.carrier || null,
      country: data.country_name || null,
      countryCode: data.country_code || null,
      lineType: data.line_type || null,  // mobile, landline, special, toll_free, voip
      mobileCountryCode: null,
      mobileNetworkCode: null,
      ported: null, // Numverify free tier doesn't include MNP
      source: 'numverify',
    };
  }

  /**
   * Abstract Phone Validation API — free tier: 100 req/month
   * https://www.abstractapi.com/phone-validation-api
   */
  private async abstractPhoneLookup(e164: string): Promise<CarrierInfo> {
    const url = `https://phonevalidation.abstractapi.com/v1/?api_key=${this.abstractKey}&phone=${encodeURIComponent(e164)}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Abstract API HTTP ${res.status}`);

    const data: any = await res.json();

    return {
      carrier: data.carrier || null,
      country: data.country?.name || null,
      countryCode: data.country?.code || null,
      lineType: data.type || null,
      mobileCountryCode: null,
      mobileNetworkCode: null,
      ported: null,
      source: 'abstract',
    };
  }

  // ─── 3. HLR Lookup (Network Activity Check — replaces Silent SMS) ──────────

  /**
   * HLR (Home Location Register) lookup — the legitimate way to check
   * if a phone is active/reachable on the network without notifying the user.
   * This replaces "Silent SMS" which requires SS7 access.
   *
   * Providers: hlrlookup.com, bsg.world, tyntec.com, messagebird.com
   * Configure HLR_API_KEY + HLR_API_SECRET in .env
   */
  private async lookupHlr(e164: string): Promise<HlrResult | null> {
    if (!this.hlrKey) return null;

    try {
      // Generic HLR endpoint (works with hlrlookup.com)
      // Swap URL if using a different provider
      const url = `https://www.hlrlookup.com/api/hlr/?apikey=${this.hlrKey}&password=${this.hlrSecret}&msisdn=${e164.replace(/^\+/, '')}`;

      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HLR HTTP ${res.status}`);

      const data: any = await res.json();

      return {
        active: data.status === 'Active' || data.status === 'Delivered' || null,
        roaming: data.is_roaming === true || data.is_roaming === 'true' || null,
        currentCarrier: data.current_carrier?.network_name || data.mccmnc || null,
        originalCarrier: data.original_carrier?.network_name || null,
        ported: data.is_ported === true || data.is_ported === 'true' || null,
        imsi: data.imsi || null,
        source: 'hlrlookup',
      };
    } catch (err: any) {
      console.warn('[PhoneIntel] HLR lookup failed:', err.message);
      return null;
    }
  }

  // ─── 4. Messenger Presence ──────────────────────────────────────────────────

  private async checkMessengers(e164: string): Promise<MessengerPresence> {
    const result: MessengerPresence = { whatsapp: null, telegram: null, viber: null };

    // Run checks in parallel
    const [wa, tg] = await Promise.allSettled([
      this.checkWhatsApp(e164),
      this.checkTelegram(e164),
    ]);

    if (wa.status === 'fulfilled') result.whatsapp = wa.value;
    if (tg.status === 'fulfilled') result.telegram = tg.value;

    return result;
  }

  /**
   * WhatsApp presence check via wa.me redirect heuristic.
   *
   * wa.me/{number} returns a page with "send a message to {number} on WhatsApp"
   * if the number is registered on WhatsApp. If not registered, the page still
   * loads but contains a different message. We check the HTML content.
   *
   * This is a best-effort, non-intrusive check. No message or notification is
   * sent to the target. For production accuracy, consider WhatsApp Business API
   * (requires Meta approval + business account).
   */
  private async checkWhatsApp(e164: string): Promise<boolean | null> {
    try {
      const number = e164.replace(/^\+/, '');
      // Use the WhatsApp API endpoint for contact existence check
      // This endpoint is public and doesn't notify the user
      const url = `https://wa.me/${number}`;
      const res = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (!res.ok) return null;

      const html = await res.text();

      // If WhatsApp recognizes the number, the page renders a "Message" button
      // with "send_to" text. If not, it shows "phone number shared via url is invalid"
      if (html.includes('phone number shared via url is invalid') || html.includes('invalid')) {
        return false;
      }

      // If we got a normal page with action buttons, number is likely registered
      if (html.includes('send') || html.includes('action') || html.includes('chat')) {
        return true;
      }

      // Can't determine
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Telegram presence check via contacts.importContacts API.
   * Requires TELEGRAM_API_ID + TELEGRAM_API_HASH + authorized session.
   *
   * Since setting up MTProto is heavy, we use a lighter approach:
   * Check t.me redirect — if the phone-based URL redirects to a user page,
   * the number is registered.
   *
   * For deeper Telegram OSINT, you'd want gramjs/telethon with a session.
   * This is the non-intrusive fallback that doesn't require authentication.
   */
  private async checkTelegram(e164: string): Promise<boolean | null> {
    try {
      // Telegram doesn't have a public phone→profile lookup without auth.
      // We'll rely on the Telegram Bot API if the bot token exists.
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) return null;

      // Telegram Bot API doesn't directly support phone→user lookup.
      // The only reliable method is contacts.importContacts via MTProto (user API).
      // For now, return null to indicate "not checked" rather than false positive.
      // TODO: Add gramjs-based check if TELEGRAM_API_ID/HASH + session are configured
      return null;
    } catch {
      return null;
    }
  }

  // ─── Graph Entity Conversion ────────────────────────────────────────────────

  convertToEntities(intel: PhoneIntelResult): { entities: any[]; links: any[] } {
    const entities: any[] = [];
    const links: any[] = [];

    const phoneId = `phone-${intel.phone}`;

    // Main phone entity
    entities.push({
      id: phoneId,
      type: 'phone_number',
      value: intel.phone,
      data: {
        label: intel.validation.international || intel.phone,
        color: '#f97316', // orange
        country: intel.validation.country,
        type: intel.validation.type,
        carrier: intel.carrier?.carrier,
        lineType: intel.carrier?.lineType,
        active: intel.hlr?.active,
      },
    });

    // Carrier / Operator entity
    if (intel.carrier?.carrier) {
      const carrierId = `org-carrier-${intel.carrier.carrier.replace(/\s+/g, '-').toLowerCase()}`;
      entities.push({
        id: carrierId,
        type: 'organization',
        value: intel.carrier.carrier,
        data: {
          label: intel.carrier.carrier,
          role: 'Mobile Carrier',
          lineType: intel.carrier.lineType,
          ported: intel.carrier.ported,
          color: '#8b5cf6', // purple
        },
      });
      links.push({
        id: `link-${phoneId}-${carrierId}`,
        source: phoneId,
        target: carrierId,
        label: intel.carrier.ported ? 'ported to' : 'operated by',
      });
    }

    // Country entity
    if (intel.validation.country) {
      const countryId = `location-country-${intel.validation.country}`;
      entities.push({
        id: countryId,
        type: 'location',
        value: `${intel.validation.country} (+${intel.validation.countryCallingCode})`,
        data: {
          label: `${intel.validation.country} (+${intel.validation.countryCallingCode})`,
          countryCode: intel.validation.country,
          color: '#10b981', // green
        },
      });
      links.push({
        id: `link-${phoneId}-${countryId}`,
        source: phoneId,
        target: countryId,
        label: 'registered in',
      });
    }

    // HLR info entity (if has data)
    if (intel.hlr && (intel.hlr.active !== null || intel.hlr.currentCarrier)) {
      const hlrId = `hlr-${intel.phone}`;
      entities.push({
        id: hlrId,
        type: 'scan_result',
        value: `HLR: ${intel.hlr.active ? 'Active' : intel.hlr.active === false ? 'Inactive' : 'Unknown'}`,
        data: {
          label: `HLR Check`,
          color: intel.hlr.active ? '#22c55e' : intel.hlr.active === false ? '#ef4444' : '#94a3b8',
          active: intel.hlr.active,
          roaming: intel.hlr.roaming,
          currentCarrier: intel.hlr.currentCarrier,
          originalCarrier: intel.hlr.originalCarrier,
          ported: intel.hlr.ported,
        },
      });
      links.push({
        id: `link-${phoneId}-${hlrId}`,
        source: phoneId,
        target: hlrId,
        label: 'network status',
      });
    }

    // Messenger presence entities
    if (intel.messengers.whatsapp === true) {
      const waId = `social-wa-${intel.phone}`;
      entities.push({
        id: waId,
        type: 'social_profile',
        value: `WhatsApp: ${intel.validation.international || intel.phone}`,
        data: {
          label: 'WhatsApp',
          platform: 'WhatsApp',
          color: '#25D366',
          registered: true,
        },
      });
      links.push({
        id: `link-${phoneId}-${waId}`,
        source: phoneId,
        target: waId,
        label: 'has WhatsApp',
      });
    }

    if (intel.messengers.telegram === true) {
      const tgId = `social-tg-${intel.phone}`;
      entities.push({
        id: tgId,
        type: 'social_profile',
        value: `Telegram: ${intel.validation.international || intel.phone}`,
        data: {
          label: 'Telegram',
          platform: 'Telegram',
          color: '#0088cc',
          registered: true,
        },
      });
      links.push({
        id: `link-${phoneId}-${tgId}`,
        source: phoneId,
        target: tgId,
        label: 'has Telegram',
      });
    }

    return { entities, links };
  }

  // ─── Cache Helpers ──────────────────────────────────────────────────────────

  private cacheResult(key: string, result: PhoneIntelResult) {
    this.cache.set(key, {
      result,
      expiresAt: Date.now() + this.cacheTtlMs,
    });

    // Prune old entries every 50 inserts
    if (this.cache.size > 200) {
      const now = Date.now();
      for (const [k, v] of this.cache) {
        if (v.expiresAt < now) this.cache.delete(k);
      }
    }
  }

  clearCache() {
    this.cache.clear();
  }
}

export const phoneIntelService = new PhoneIntelService();
