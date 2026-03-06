import { parseDescription, findBestMatch, resolveItemsFromDescription } from '../../../server/src/services/description-parser';

describe('parseDescription', () => {
  it('parses numeric quantity + item name', () => {
    const result = parseDescription('5 Edison robots');
    expect(result).toEqual([
      { name: 'Edison robots', type: 'COUNTED', expectedQuantity: 5 },
    ]);
  });

  it('parses word numbers', () => {
    const result = parseDescription('five micro:bit boards');
    expect(result).toEqual([
      { name: 'micro:bit boards', type: 'COUNTED', expectedQuantity: 5 },
    ]);
  });

  it('parses comma-separated items', () => {
    const result = parseDescription('3 laptops, 3 chargers, 3 mice');
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ name: 'laptops', type: 'COUNTED', expectedQuantity: 3 });
    expect(result[1]).toEqual({ name: 'chargers', type: 'COUNTED', expectedQuantity: 3 });
    expect(result[2]).toEqual({ name: 'mice', type: 'COUNTED', expectedQuantity: 3 });
  });

  it('parses items separated by "and"', () => {
    const result = parseDescription('5 robots and 5 controllers');
    expect(result).toHaveLength(2);
  });

  it('marks batteries as consumable', () => {
    const result = parseDescription('20 AAA batteries');
    expect(result[0].type).toBe('CONSUMABLE');
  });

  it('ignores segments without a quantity', () => {
    const result = parseDescription('charging cable');
    expect(result).toEqual([]);
  });

  it('returns empty for empty description', () => {
    expect(parseDescription('')).toEqual([]);
    expect(parseDescription('  ')).toEqual([]);
  });
});

describe('findBestMatch', () => {
  const existing = [
    { name: 'Edison V3 robot', type: 'COUNTED' },
    { name: 'BBC micro:bit v2', type: 'COUNTED' },
    { name: 'HP Laptop 17T-cn300', type: 'COUNTED' },
    { name: 'AAA batteries', type: 'CONSUMABLE' },
  ];

  it('matches "Edison robots" to "Edison V3 robot"', () => {
    const match = findBestMatch('Edison robots', existing);
    expect(match).not.toBeNull();
    expect(match!.name).toBe('Edison V3 robot');
  });

  it('matches "micro:bit boards" to "BBC micro:bit v2"', () => {
    const match = findBestMatch('micro:bit boards', existing);
    expect(match).not.toBeNull();
    expect(match!.name).toBe('BBC micro:bit v2');
  });

  it('returns null for no match', () => {
    const match = findBestMatch('completely unrelated item', existing);
    expect(match).toBeNull();
  });
});

describe('resolveItemsFromDescription', () => {
  const existing = [
    { name: 'Edison V3 robot', type: 'COUNTED' },
    { name: 'Wireless mouse', type: 'COUNTED' },
  ];

  it('resolves items with fuzzy matching', () => {
    const result = resolveItemsFromDescription('5 Edison robots', existing);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Edison V3 robot');
    expect(result[0].expectedQuantity).toBe(5);
    expect(result[0].type).toBe('COUNTED');
  });

  it('keeps original name when no match', () => {
    const result = resolveItemsFromDescription('11 remotes', existing);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('remotes');
    expect(result[0].expectedQuantity).toBe(11);
  });
});
