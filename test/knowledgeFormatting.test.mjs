import { describe, it, expect } from 'vitest';
import formatting from '../src/utils/knowledgeFormatting.js';

const {
    formatKnowledgeId,
    parseKnowledgeId,
    createKnowledgeExcerpt,
    formatAcceptedMarker,
    formatConfidenceLabel,
    embedSafeText
} = formatting;

describe('knowledge formatting utils', () => {
    it('formats knowledge ids', () => {
        expect(formatKnowledgeId(123)).toBe('KNW-000123');
    });

    it('parses numeric and KNW ids', () => {
        expect(parseKnowledgeId('123')).toBe(123);
        expect(parseKnowledgeId('KNW-000123')).toBe(123);
    });

    it('truncates excerpts', () => {
        const v = createKnowledgeExcerpt('a'.repeat(100), 20);
        expect(v.length).toBeLessThanOrEqual(20);
        expect(v.endsWith('…')).toBe(true);
    });

    it('formats accepted marker', () => {
        expect(formatAcceptedMarker(true)).toContain('Accepted');
        expect(formatAcceptedMarker(false)).toContain('Unaccepted');
    });

    it('formats confidence label', () => {
        expect(formatConfidenceLabel('high')).toContain('HIGH');
        expect(formatConfidenceLabel('medium')).toContain('MEDIUM');
        expect(formatConfidenceLabel('low')).toContain('LOW');
    });

    it('keeps embed-safe truncation within limit', () => {
        const text = embedSafeText('x'.repeat(3000), 1024);
        expect(text.length).toBeLessThanOrEqual(1024);
    });
});
