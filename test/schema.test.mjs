import { describe, it, expect } from 'vitest';
import schema from '../src/database/schema.js';

describe('schema', () => {
    it('contains knowledge engine tables', () => {
        const joined = schema.schemaStatements.join('\n');
        expect(joined).toContain('CREATE TABLE IF NOT EXISTS knowledge_entries');
        expect(joined).toContain('CREATE TABLE IF NOT EXISTS knowledge_events');
    });
});
