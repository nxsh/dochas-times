import { describe, it, expect } from 'vitest';
import { parseResponse, ScreeningResult } from '../services/llm';

describe('LLM screening', () => {
  it('should parse valid rubric JSON response', () => {
    const json = JSON.stringify({
      is_positive: true,
      category: 'community',
      valence_score: 8,
      locality: 'Oxford',
      why_one_line: 'Community garden project benefits local residents.',
      suggested_headline: 'Oxford Community Garden Blooms',
      flags: ['none'],
      needs_human_check: false,
    });

    const result = parseResponse(json);
    expect(result.is_positive).toBe(true);
    expect(result.category).toBe('community');
    expect(result.valence_score).toBe(8);
    expect(result.locality).toBe('Oxford');
    expect(result.flags).toEqual(['none']);
    expect(result.needs_human_check).toBe(false);
  });

  it('should parse response wrapped in code fences', () => {
    const wrapped = '```json\n' + JSON.stringify({
      is_positive: true,
      category: 'environment',
      valence_score: 7,
      locality: 'Witney',
      why_one_line: 'Recycling project launches.',
      suggested_headline: 'Witney Goes Green',
      flags: ['none'],
      needs_human_check: false,
    }) + '\n```';

    const result = parseResponse(wrapped);
    expect(result.is_positive).toBe(true);
    expect(result.category).toBe('environment');
    expect(result.valence_score).toBe(7);
  });

  it('should parse response with surrounding text', () => {
    const withText = 'Here is my analysis:\n\n' + JSON.stringify({
      is_positive: false,
      category: 'other',
      valence_score: 2,
      locality: 'UK-wide',
      why_one_line: 'This appears to be an advertisement.',
      suggested_headline: 'Product Launch Announcement',
      flags: ['possible_ad'],
      needs_human_check: true,
    }) + '\n\nI hope this helps!';

    const result = parseResponse(withText);
    expect(result.is_positive).toBe(false);
    expect(result.valence_score).toBe(2);
    expect(result.flags).toEqual(['possible_ad']);
    expect(result.needs_human_check).toBe(true);
  });

  it('should throw on completely invalid JSON', () => {
    expect(() => parseResponse('This is not JSON at all')).toThrow();
  });

  it('should clamp valence_score to 0-10 range', () => {
    const highScore = JSON.stringify({
      is_positive: true,
      category: 'community',
      valence_score: 15,
      locality: 'Oxford',
      why_one_line: 'Test',
      suggested_headline: 'Test',
      flags: ['none'],
      needs_human_check: false,
    });

    expect(parseResponse(highScore).valence_score).toBe(10);

    const negativeScore = JSON.stringify({
      is_positive: true,
      category: 'community',
      valence_score: -5,
      locality: 'Oxford',
      why_one_line: 'Test',
      suggested_headline: 'Test',
      flags: ['none'],
      needs_human_check: false,
    });

    expect(parseResponse(negativeScore).valence_score).toBe(0);
  });

  it('should normalise flags array when not an array', () => {
    const noFlags = JSON.stringify({
      is_positive: true,
      category: 'community',
      valence_score: 8,
      locality: 'Oxford',
      why_one_line: 'Test',
      suggested_headline: 'Test',
      flags: 'none',
      needs_human_check: false,
    });

    const result = parseResponse(noFlags);
    expect(Array.isArray(result.flags)).toBe(true);
    expect(result.flags).toEqual(['none']);
  });

  it('should handle missing optional fields gracefully', () => {
    const minimal = JSON.stringify({
      is_positive: true,
      valence_score: 5,
    });

    const result = parseResponse(minimal);
    expect(result.is_positive).toBe(true);
    expect(result.category).toBe('other');
    expect(result.valence_score).toBe(5);
    expect(result.locality).toBe('Unknown');
    expect(result.why_one_line).toBe('');
    expect(result.suggested_headline).toBe('');
    expect(result.flags).toEqual(['none']);
  });

  it('should handle valence_score as string', () => {
    const stringScore = JSON.stringify({
      is_positive: true,
      category: 'youth',
      valence_score: '7',
      locality: 'Abingdon',
      why_one_line: 'Youth club opens.',
      suggested_headline: 'New Youth Club for Abingdon',
      flags: ['none'],
      needs_human_check: false,
    });

    const result = parseResponse(stringScore);
    expect(result.valence_score).toBe(7);
  });

  it('should parse code fences without json language tag', () => {
    const fenced = '```\n' + JSON.stringify({
      is_positive: true,
      category: 'milestone',
      valence_score: 9,
      locality: 'Bicester',
      why_one_line: 'Local runner wins medal.',
      suggested_headline: 'Bicester Runner Triumphs',
      flags: ['none'],
      needs_human_check: false,
    }) + '\n```';

    const result = parseResponse(fenced);
    expect(result.category).toBe('milestone');
    expect(result.valence_score).toBe(9);
  });
});
