import { extractJsonObject } from '../../ollamaService';

describe('extractJsonObject', () => {
  it('extracts JSON when preceded by tags', () => {
    const input = '<think> {"stance":5}';
    const result = extractJsonObject(input);
    expect(result).toBe('{"stance":5}');
  });

  it('handles nested braces', () => {
    const input = 'prefix {"a":1, "b": {"c":2}} suffix';
    const result = extractJsonObject(input);
    expect(result).toBe('{"a":1, "b": {"c":2}}');
  });

  it('returns null when no braces', () => {
    const input = 'no json here';
    const result = extractJsonObject(input);
    expect(result).toBeNull();
  });
});
