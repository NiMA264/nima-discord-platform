import { describe, it, expect } from 'vitest';
import fs from 'fs';

describe('deploy commands list', () => {
    it('includes /knowledge command in deployment script', () => {
        const content = fs.readFileSync('src/deploy-commands.js', 'utf8');
        expect(content).toContain("const knowledgeCommand = require('./commands/knowledge');");
        expect(content).toContain('knowledgeCommand.data.toJSON()');
        expect(content).toContain('/knowledge');
    });

    it('includes /dev command in deployment script', () => {
        const content = fs.readFileSync('src/deploy-commands.js', 'utf8');
        expect(content).toContain("const devCommand = require('./commands/dev');");
        expect(content).toContain('devCommand.data.toJSON()');
        expect(content).toContain('/dev');
    });
});
