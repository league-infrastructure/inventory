/**
 * Parses pack descriptions to extract item mentions and fuzzy-match
 * against existing item names for consistency.
 */

interface ParsedItem {
  name: string;
  type: 'COUNTED' | 'CONSUMABLE';
  expectedQuantity: number | null;
}

interface ExistingItem {
  name: string;
  type: string;
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
};

const CONSUMABLE_HINTS = ['batteries', 'cable ties', 'zip ties', 'tape', 'velcro', 'stickers', 'labels'];

/**
 * Parse a description string into potential item entries.
 * Handles patterns like:
 *   "5 Edison robots"
 *   "five micro:bit boards"
 *   "Edison robots, chargers, and cables"
 */
export function parseDescription(description: string): ParsedItem[] {
  if (!description || description.trim().length === 0) return [];

  const items: ParsedItem[] = [];
  // Split on commas, "and", semicolons
  const segments = description.split(/[,;]|\band\b/i).map((s) => s.trim()).filter(Boolean);

  for (const segment of segments) {
    const parsed = parseSegment(segment);
    if (parsed) items.push(parsed);
  }

  return items;
}

function parseSegment(segment: string): ParsedItem | null {
  // Try to match: <number> <item name> or <word-number> <item name>
  const numMatch = segment.match(/^(\d+)\s+(.+)$/);
  if (numMatch) {
    const qty = parseInt(numMatch[1], 10);
    const name = cleanItemName(numMatch[2]);
    if (name.length > 0) {
      return { name, type: isConsumable(name) ? 'CONSUMABLE' : 'COUNTED', expectedQuantity: qty };
    }
  }

  const wordMatch = segment.match(/^(\w+)\s+(.+)$/);
  if (wordMatch) {
    const wordNum = WORD_NUMBERS[wordMatch[1].toLowerCase()];
    if (wordNum) {
      const name = cleanItemName(wordMatch[2]);
      if (name.length > 0) {
        return { name, type: isConsumable(name) ? 'CONSUMABLE' : 'COUNTED', expectedQuantity: wordNum };
      }
    }
  }

  // No quantity found — don't auto-create (description is just descriptive text)
  return null;
}

function cleanItemName(raw: string): string {
  return raw.replace(/[.!?]+$/, '').trim();
}

function isConsumable(name: string): boolean {
  const lower = name.toLowerCase();
  return CONSUMABLE_HINTS.some((hint) => lower.includes(hint));
}

/**
 * Compute similarity between two strings (case-insensitive).
 * Uses token overlap with stemming (strip trailing 's'/'es') and
 * substring matching for partial token matches.
 */
function similarity(a: string, b: string): number {
  const tokensA = a.toLowerCase().split(/\s+/);
  const tokensB = b.toLowerCase().split(/\s+/);

  function stem(word: string): string {
    return word.replace(/(?:ies$)/, 'y').replace(/(?:es|s)$/, '');
  }

  const stemsB = tokensB.map(stem);

  let matches = 0;
  for (const ta of tokensA) {
    const sa = stem(ta);
    // Exact stem match or substring containment
    if (stemsB.some((sb) => sa === sb || sb.includes(sa) || sa.includes(sb))) {
      matches++;
    }
  }

  return (2 * matches) / (tokensA.length + tokensB.length);
}

/**
 * Find the best matching existing item name for a parsed name.
 * Returns the existing item if similarity >= threshold.
 */
export function findBestMatch(
  parsedName: string,
  existingItems: ExistingItem[],
  threshold = 0.35,
): ExistingItem | null {
  let best: ExistingItem | null = null;
  let bestScore = 0;

  for (const existing of existingItems) {
    const score = similarity(parsedName, existing.name);
    if (score > bestScore) {
      bestScore = score;
      best = existing;
    }
  }

  // Also check if one contains the other (substring match)
  const lowerParsed = parsedName.toLowerCase();
  for (const existing of existingItems) {
    const lowerExisting = existing.name.toLowerCase();
    if (lowerExisting.includes(lowerParsed) || lowerParsed.includes(lowerExisting)) {
      const subScore = Math.min(lowerParsed.length, lowerExisting.length) / Math.max(lowerParsed.length, lowerExisting.length);
      if (subScore > bestScore) {
        bestScore = subScore;
        best = existing;
      }
    }
  }

  return bestScore >= threshold ? best : null;
}

/**
 * Parse description, match against existing items, and return items to create.
 */
export function resolveItemsFromDescription(
  description: string,
  existingItems: ExistingItem[],
): ParsedItem[] {
  const parsed = parseDescription(description);

  return parsed.map((item) => {
    const match = findBestMatch(item.name, existingItems);
    if (match) {
      return {
        ...item,
        name: match.name,
        type: (match.type as 'COUNTED' | 'CONSUMABLE') || item.type,
      };
    }
    return item;
  });
}
