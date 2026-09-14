import {
  DEFAULT_TRANSACTION_CATEGORY,
  TransactionCategory,
} from './enums/transaction-category.enum';

/**
 * Parsing for Worship Harvest's mobile-money statement exports.
 *
 * Two shapes arrive. The richer one carries a "To message" column holding the
 * free text the giver typed; the plain MoMo export has no message column at
 * all. Real "To message" values look like:
 *
 *   WHARUAYXPOFFERTORY      code and category run together, no separators
 *   Arua WH                 a campus, no category
 *   tbgb0095 tithe          tithe number and category
 *   TBGB0416(Imbazo)        tithe number with a group in brackets
 *   TBGB0148                tithe number only
 *
 * So the message is not a sentence: it is several fields crammed into one box
 * with no delimiter, in whatever case the sender felt like. Everything here is
 * pure so it can be unit-tested against those strings without a database.
 */

/**
 * Words that identify a giving category. Ordered longest-first within each
 * group so "arise and build" is not shadowed by a bare "build", and the groups
 * are ordered so a more specific category wins when a message names two.
 */
const CATEGORY_KEYWORDS: Array<{
  category: TransactionCategory;
  keywords: string[];
}> = [
  {
    category: TransactionCategory.ARISE_BUILD,
    keywords: [
      'arise and build',
      'arise & build',
      'arise&build',
      'arisebuild',
      'arise build',
      'building fund',
      'building',
      'a&b',
      'arise',
    ],
  },
  {
    category: TransactionCategory.TITHE,
    keywords: ['tithes', 'tithe', 'zaka', 'tenth'],
  },
  {
    category: TransactionCategory.OFFERING,
    keywords: [
      'offertory',
      'offerings',
      'offering',
      'offeratory',
      'sadaka',
      'collection',
    ],
  },
  {
    category: TransactionCategory.DONATION,
    keywords: [
      'donations',
      'donation',
      'donate',
      'thanksgiving',
      'pledge',
      'seed',
      'gift',
    ],
  },
];

/**
 * Tithe numbers are a letter prefix followed by digits, e.g. TBGB0095,
 * TBGB0416, tbgb0148. Case is whatever the sender typed.
 */
const TITHE_CODE = /\b([a-z]{2,6}\d{3,6})\b/i;

/** The same code when it is jammed against other text, e.g. "TBGB0416(Imbazo)". */
const TITHE_CODE_LOOSE = /([a-z]{2,6}\d{3,6})/i;

/** A tithe number written as digits with an explicit label. */
const TITHE_LABELLED =
  /(?:tithe\s*(?:no|number|num|#)?|tn|#)\s*[:\-.]?\s*(\d{3,10})\b/i;

/**
 * A campus code standing on its own, e.g. "WHEBCT tithe". Only usable when the
 * code is delimited — see `extractLocationCode` for the ambiguous case.
 */
const LOCATION_CODE = /\bWH([A-Z]{2,6})\b/i;

/** Titles and filler that are never part of the giver's actual name. */
const NAME_NOISE = new Set([
  'mr', 'mrs', 'ms', 'miss', 'dr', 'rev', 'ps', 'pr', 'pastor',
  'bro', 'sis', 'brother', 'sister',
  'from', 'for', 'to', 'the', 'and', 'my', 'of',
  'no', 'number', 'num', 'tn', 'ref',
  'church', 'payment', 'pay', 'money', 'cash', 'ugx', 'shs', 'wh',
]);

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalize = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9&\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const toTitleCase = (word: string): string =>
  word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

/**
 * The giving category named in the message, or null when none is recognised.
 *
 * Tries whole words first, then falls back to a substring scan, because senders
 * routinely run everything together ("WHARUAYXPOFFERTORY"). Strip the tithe
 * number and campus code before calling this to keep the substring pass from
 * reading a category out of an identifier.
 */
export const detectCategory = (
  text?: string | null,
): TransactionCategory | null => {
  if (!text) return null;
  const haystack = normalize(text);
  if (!haystack) return null;

  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    for (const keyword of keywords) {
      const pattern = new RegExp(`(^|\\s)${escapeRegExp(keyword)}($|\\s)`);
      if (pattern.test(haystack)) return category;
    }
  }

  const squashed = haystack.replace(/\s+/g, '');
  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    for (const keyword of keywords) {
      const needle = keyword.replace(/[\s&]/g, '');
      // Only long keywords are safe to match mid-token; short ones like "a&b"
      // would fire on ordinary names.
      if (needle.length >= 5 && squashed.includes(needle)) return category;
    }
  }

  return null;
};

/**
 * The giver's tithe number: a letter-and-digit code such as TBGB0095, else a
 * labelled digit run ("tithe no 4471"). Returned upper-cased so TBGB0095 and
 * tbgb0095 are the same giver.
 */
export const extractTitheNumber = (text?: string | null): string | null => {
  if (!text) return null;

  const code = text.match(TITHE_CODE) ?? text.match(TITHE_CODE_LOOSE);
  if (code) return code[1].toUpperCase();

  const labelled = text.match(TITHE_LABELLED);
  if (labelled) return labelled[1];

  return null;
};

/**
 * Campus code from the message, upper-cased, or null.
 *
 * Senders run the code into the rest of the message ("WHARUAYXPOFFERTORY"),
 * where no regex can tell where the code stops — WHARUA, WHARUAY and WHARUAYX
 * are all plausible. So pass `knownCodes` (the locations' `Group.metaData.code`
 * values) and the longest one actually present wins. Without that list only a
 * properly delimited code can be read, and anything glued to other text
 * returns null rather than a guess.
 */
export const extractLocationCode = (
  text?: string | null,
  knownCodes: string[] = [],
): string | null => {
  if (!text) return null;

  if (knownCodes.length > 0) {
    const haystack = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const hit = knownCodes
      .filter(Boolean)
      .map((code) => code.toUpperCase().replace(/[^A-Z0-9]/g, ''))
      .filter((code) => code && haystack.includes(code))
      // Longest first, so WHARUA beats a shorter code that is its prefix.
      .sort((a, b) => b.length - a.length)[0];
    if (hit) return hit;
  }

  const match = text.match(LOCATION_CODE);
  return match ? `WH${match[1]}`.toUpperCase() : null;
};

/**
 * The MSISDN inside a statement's party column.
 *
 * These arrive as `FRI:256763676927/MSISDN` rather than a bare number, so the
 * importer would otherwise record no phone at all — and phone is the matcher's
 * most reliable signal after the tithe number.
 *
 * Only the `/MSISDN` form is a phone. The same column also carries wallet
 * identifiers such as `FRI:204945451/MM`, and treating one of those as a phone
 * number would match the giver to the wrong person.
 */
export const extractPhone = (value?: string | null): string | null => {
  if (!value) return null;

  const msisdn = value.match(/FRI:(\d{6,15})\/MSISDN/i);
  if (msisdn) return msisdn[1];

  // Any other FRI is an account identifier, not a phone.
  if (/FRI:/i.test(value)) return null;

  const digits = value.replace(/\D/g, '');
  return digits.length >= 9 ? digits : null;
};

/**
 * Best-effort person name from the message: whatever survives once category
 * words, identifiers, digits and filler are removed. Returns null when fewer
 * than two usable words remain, since a lone token is more likely noise than
 * a name.
 */
export const extractPersonName = (text?: string | null): string | null => {
  if (!text) return null;

  let residue = normalize(text);
  if (!residue) return null;

  for (const { keywords } of CATEGORY_KEYWORDS) {
    for (const keyword of keywords) {
      residue = residue.replace(new RegExp(escapeRegExp(keyword), 'g'), ' ');
    }
  }

  const words = residue
    .split(/\s+/)
    .filter((word) => word && !/\d/.test(word) && !NAME_NOISE.has(word));

  if (words.length < 2) return null;
  return words.map(toTitleCase).join(' ');
};

/**
 * Tidies a statement's name column. These arrive SHOUTING, padded with double
 * spaces ("ELAINE   KEZIAH AYIKORU"), and sometimes with the number attached.
 */
export const cleanSenderName = (raw?: string | null): string | null => {
  if (!raw) return null;

  const cleaned = raw
    .replace(/FRI:\S+/gi, ' ')
    .replace(/\+?\d[\d\s\-()]{6,}\d/g, ' ')
    .replace(/[_|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[-–—,.;:]+|[-–—,.;:]+$/g, '')
    .trim();

  if (!cleaned) return null;

  // Only re-case strings that are entirely one case; leave "McDonald" alone.
  const shouldRecase =
    cleaned === cleaned.toUpperCase() || cleaned === cleaned.toLowerCase();
  return shouldRecase
    ? cleaned.split(/\s+/).map(toTitleCase).join(' ')
    : cleaned;
};

export interface ParsedStatementMessage {
  /** Category named in the message, or the tithe default when none was found. */
  category: TransactionCategory;
  /** True when the category came from the message rather than the fallback. */
  categoryDetected: boolean;
  titheNumber: string | null;
  locationCode: string | null;
  name: string | null;
}

/**
 * Reads everything Zoe can get out of one "To message" value.
 *
 * Identifiers are pulled out and removed before the category and name are read,
 * so a code like TBGB0416 cannot be mistaken for either. An unrecognised or
 * absent message yields tithe, because the plain MoMo export has no message
 * column at all and unspecified giving is treated as tithe.
 */
export const parseStatementMessage = (
  text?: string | null,
  knownLocationCodes: string[] = [],
): ParsedStatementMessage => {
  const titheNumber = extractTitheNumber(text);
  const locationCode = extractLocationCode(text, knownLocationCodes);

  let residue = text ?? '';
  if (titheNumber) {
    residue = residue.replace(new RegExp(escapeRegExp(titheNumber), 'gi'), ' ');
  }
  if (locationCode) {
    residue = residue.replace(new RegExp(escapeRegExp(locationCode), 'gi'), ' ');
  }

  const category = detectCategory(residue);

  return {
    category: category ?? DEFAULT_TRANSACTION_CATEGORY,
    categoryDetected: category !== null,
    titheNumber,
    locationCode,
    name: extractPersonName(residue),
  };
};

// ── QuickBooks item matching ─────────────────────────────────────────────────

export interface GivingItemCandidate {
  id: string;
  name: string;
}

/** Words too generic to identify an item on their own. */
const ITEM_STOP_WORDS = new Set(['and', 'the', 'of', 'for']);

const squash = (text: string): string =>
  text.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * The QuickBooks product/service a statement message is asking for.
 *
 * Zoe's four-value category cannot express the twelve giving items the church
 * actually books against, so the message is matched to a real item instead. An
 * item wins when every significant word of its name appears in the message —
 * that is what lets `WHARUAYXPOFFERTORY` resolve to "Offertory - YXP" rather
 * than to a generic offering, even though the sender typed no separators.
 *
 * Where several items match, the most specific one (most characters matched)
 * wins, so "Offertory - YXP" beats a bare "Offertory".
 */
export const detectGivingItem = (
  text: string | null | undefined,
  items: GivingItemCandidate[],
): GivingItemCandidate | null => {
  if (!text || items.length === 0) return null;

  const haystack = squash(text);
  if (!haystack) return null;

  let best: { item: GivingItemCandidate; score: number } | null = null;

  for (const item of items) {
    const tokens = (item.name ?? '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3 && !ITEM_STOP_WORDS.has(t));

    if (tokens.length === 0) continue;

    let score = 0;
    const matchedAll = tokens.every((token) => {
      if (haystack.includes(token)) {
        score += token.length;
        return true;
      }
      // Senders write "tithe" where the item is "Tithes".
      const singular = token.replace(/s$/, '');
      if (singular.length >= 3 && haystack.includes(singular)) {
        score += singular.length;
        return true;
      }
      return false;
    });

    if (matchedAll && (!best || score > best.score)) {
      best = { item, score };
    }
  }

  return best ? best.item : null;
};
