import { describe, it, expect } from 'vitest';
import devSystem from '../src/systems/devProductivitySystem.js';
import devFormatting from '../src/utils/devFormatting.js';
import devCommand from '../src/commands/dev.js';

const {
    validateCodeLength,
    validateDebugInputLength,
    buildReviewPrompt,
    buildGenerateTestsPrompt,
    buildDebugErrorPrompt,
    buildOptimizePrompt,
    handleDevExplain,
    handleDevReview,
    handleDevDebugError,
    handleDevOptimize,
    sanitizeCodeInput
} = devSystem;
const { formatDevEmbedContent, parseMarkdownSections } = devFormatting;

describe('dev productivity commands', () => {
    it('rejects explain input when code is too long', () => {
        const result = validateCodeLength('x'.repeat(3501));
        expect(result.ok).toBe(false);
        expect(result.code).toBe('code-too-long');
    });

    it('processes review focus in prompt', () => {
        const prompt = buildReviewPrompt({
            code: 'const a = 1;',
            language: 'javascript',
            focus: 'security'
        });
        expect(prompt).toContain('Focus: security');
    });

    it('includes framework in generate-tests prompt', () => {
        const prompt = buildGenerateTestsPrompt({
            code: 'function sum(a,b){return a+b}',
            language: 'javascript',
            framework: 'vitest'
        });
        expect(prompt).toContain('Framework: vitest');
    });

    it('command definition contains /dev debug-error', () => {
        const json = devCommand.data.toJSON();
        const subcommands = (json.options || []).map(option => option.name);
        expect(subcommands).toContain('debug-error');
    });

    it('command definition contains /dev optimize', () => {
        const json = devCommand.data.toJSON();
        const subcommands = (json.options || []).map(option => option.name);
        expect(subcommands).toContain('optimize');
    });

    it('debug-error executes via command routing path', async () => {
        const calls = [];
        const interaction = {
            options: {
                getSubcommand: () => 'debug-error',
                getString: name => ({
                    error: 'TypeError: x is undefined',
                    code: 'const x = obj.value;',
                    language: 'javascript',
                    context: ''
                }[name] || null)
            },
            deferReply: async () => {},
            editReply: async payload => {
                calls.push(payload);
            }
        };

        await devCommand.execute(interaction, { ai: { enabled: false } });
        expect(calls.length).toBe(1);
        expect(calls[0].embeds?.length).toBe(1);
    });

    it('debug-error embed contains Likely Cause only once and keeps required sections', async () => {
        const calls = [];
        const interaction = {
            options: {
                getSubcommand: () => 'debug-error',
                getString: name => ({
                    error: 'TypeError: x is undefined',
                    code: 'const x = obj.value;',
                    language: 'javascript',
                    context: ''
                }[name] || null)
            },
            deferReply: async () => {},
            editReply: async payload => {
                calls.push(payload);
            }
        };

        const config = { ai: { enabled: false } };
        await devCommand.execute(interaction, config);
        const embed = calls[0].embeds[0];
        const names = (embed.data.fields || []).map(f => f.name);
        expect(names.filter(n => n === 'Likely Cause')).toHaveLength(1);
        expect(names).toEqual(expect.arrayContaining(['Fix Steps', 'Check Next', 'Missing Context']));
    });

    it('debug-error embed contains Language exactly once when set', async () => {
        const calls = [];
        const interaction = {
            options: {
                getSubcommand: () => 'debug-error',
                getString: name => ({
                    error: 'ReferenceError: foo is not defined',
                    code: '',
                    language: 'javascript',
                    context: ''
                }[name] || null)
            },
            deferReply: async () => {},
            editReply: async payload => {
                calls.push(payload);
            }
        };

        await devCommand.execute(interaction, { ai: { enabled: false } });
        const names = (calls[0].embeds[0].data.fields || []).map(f => f.name);
        expect(names.filter(n => n === 'Language')).toHaveLength(1);
    });

    it('rejects too long combined debug input', () => {
        const result = validateDebugInputLength('a'.repeat(2000), 'b'.repeat(1200), 'c'.repeat(400));
        expect(result.ok).toBe(false);
        expect(result.code).toBe('debug-input-too-long');
    });

    it('optimize goal is handled in command execution', async () => {
        const calls = [];
        const interaction = {
            options: {
                getSubcommand: () => 'optimize',
                getString: name => ({
                    code: 'function x(v){return v+1}',
                    language: 'javascript',
                    goal: 'performance'
                }[name] || null)
            },
            deferReply: async () => {},
            editReply: async payload => {
                calls.push(payload);
            }
        };
        await devCommand.execute(interaction, { ai: { enabled: false } });
        const names = (calls[0].embeds[0].data.fields || []).map(f => f.name);
        const goalField = (calls[0].embeds[0].data.fields || []).find(f => f.name === 'Goal');
        expect(names).toContain('Goal');
        expect(goalField.value.toLowerCase()).toContain('performance');
        expect(calls[0].embeds[0].data.description).toBe('Optimization guidance generated from the provided code context.');
    });

    it('debug prompt includes error and optional code/language/context', () => {
        const prompt = buildDebugErrorPrompt({
            error: 'ReferenceError: foo is not defined',
            code: 'foo();',
            language: 'javascript',
            context: 'only in production'
        });
        expect(prompt).toContain('ReferenceError: foo is not defined');
        expect(prompt).toContain('Code (optional):');
        expect(prompt).toContain('Language: javascript');
        expect(prompt).toContain('Context (optional):');
    });

    it('optimize prompt includes goal language and code', () => {
        const prompt = buildOptimizePrompt({
            code: 'const out = list.map(x => x + 1)',
            language: 'javascript',
            goal: 'readability'
        });
        expect(prompt).toContain('Goal: readability');
        expect(prompt).toContain('Language: javascript');
        expect(prompt).toContain('Code:');
    });

    it('optimize rejects too long code', async () => {
        const result = await handleDevOptimize({}, { code: 'x'.repeat(3501), goal: 'all' }, {});
        expect(result.ok).toBe(false);
        expect(result.code).toBe('code-too-long');
    });

    it('optimize returns compact response for very short code', async () => {
        const result = await handleDevOptimize({}, { code: 'x=1', goal: 'all' }, {});
        expect(result.ok).toBe(true);
        expect(result.text).toBe('Der Code ist zu kurz fuer eine sinnvolle Optimierung.');
    });

    it('returns safe fallback response when AI call fails', async () => {
        const config = { ai: { enabled: true, model: 'gpt-4.1-mini' } };
        const deps = {
            aiClient: {
                responses: {
                    create: async () => {
                        throw new Error('boom');
                    }
                }
            }
        };
        const result = await handleDevExplain(config, { code: 'const x = 1;' }, deps);
        expect(result.ok).toBe(true);
        expect(result.text).toContain('AI-Antwort momentan nicht verfuegbar');
    });

    it('debug-error returns safe fallback response when AI call fails', async () => {
        const config = { ai: { enabled: true, model: 'gpt-4.1-mini' } };
        const deps = {
            aiClient: {
                responses: {
                    create: async () => {
                        throw new Error('boom');
                    }
                }
            }
        };
        const result = await handleDevDebugError(config, {
            error: 'TypeError: cannot read property',
            code: 'x.y()',
            context: 'startup'
        }, deps);
        expect(result.ok).toBe(true);
        expect(result.text).toContain('### Likely Cause');
    });

    it('optimize returns safe fallback response when AI call fails', async () => {
        const config = { ai: { enabled: true, model: 'gpt-4.1-mini' } };
        const telemetry = [];
        const deps = {
            aiClient: {
                responses: {
                    create: async () => {
                        throw new Error('boom');
                    }
                }
            },
            telemetryLogger: async payload => telemetry.push(payload)
        };
        const result = await handleDevOptimize(config, {
            code: 'function render(v){return `<div>${v}</div>`}',
            goal: 'all'
        }, deps);
        expect(result.ok).toBe(true);
        expect(result.text).toContain('### Quick Wins');
        expect(telemetry[0].fallbackUsed).toBe(true);
        expect(telemetry[0].success).toBe(false);
    });

    it('optimize telemetry payload contains required fields and promptVersion', async () => {
        const telemetry = [];
        const config = { ai: { enabled: false, optimizePromptVersion: 'v1.0.0' } };
        const result = await handleDevOptimize(config, {
            code: 'function sum(a,b){return a+b}',
            goal: 'readability',
            language: 'javascript'
        }, {
            telemetryLogger: async payload => telemetry.push(payload)
        });
        expect(result.ok).toBe(true);
        expect(telemetry).toHaveLength(1);
        const item = telemetry[0];
        expect(item).toEqual(expect.objectContaining({
            timestamp: expect.any(String),
            promptVersion: 'v1.0.0',
            goal: 'readability',
            language: 'javascript',
            inputLength: expect.any(Number),
            outputLength: expect.any(Number),
            truncated: expect.any(Boolean),
            fallbackUsed: expect.any(Boolean),
            durationMs: expect.any(Number),
            success: expect.any(Boolean)
        }));
    });

    it('optimize telemetry marks truncated true for long output', async () => {
        const telemetry = [];
        const config = { ai: { enabled: true, model: 'gpt-4.1-mini', optimizePromptVersion: 'v1.0.0' } };
        const deps = {
            aiClient: {
                responses: {
                    create: async () => ({ output_text: `### Quick Wins\n${'a'.repeat(5000)}` })
                }
            },
            telemetryLogger: async payload => telemetry.push(payload)
        };
        await handleDevOptimize(config, {
            code: 'function z(){return 1}',
            goal: 'all'
        }, deps);
        expect(telemetry[0].truncated).toBe(true);
    });

    it('optimize telemetry marks fallback false and success true on normal response', async () => {
        const telemetry = [];
        const config = { ai: { enabled: true, model: 'gpt-4.1-mini', optimizePromptVersion: 'v1.0.0' } };
        const deps = {
            aiClient: {
                responses: {
                    create: async () => ({ output_text: '### Quick Wins\n- simplify loop' })
                }
            },
            telemetryLogger: async payload => telemetry.push(payload)
        };
        await handleDevOptimize(config, {
            code: 'function y(items){for(const i of items){}}',
            goal: 'performance'
        }, deps);
        expect(telemetry[0].fallbackUsed).toBe(false);
        expect(telemetry[0].success).toBe(true);
    });

    it('parses markdown sections with ### Critical headings', () => {
        const sections = parseMarkdownSections([
            '### Critical',
            '- null pointer risk',
            '### Warnings',
            '- missing validation',
            '### Security',
            '- token exposure',
            '### Performance',
            '- N+1 query',
            '### Suggestions',
            '- add guard clause',
            '### Next Steps',
            '- add tests'
        ].join('\n'));
        expect(sections.map(s => s.name)).toEqual(['Critical', 'Warnings', 'Security', 'Performance', 'Suggestions', 'Next Steps']);
    });

    it('parses debug-error sections', () => {
        const sections = parseMarkdownSections([
            '### Likely Cause',
            '- null access',
            '### Fix Steps',
            '- add guard',
            '### Check Next',
            '- verify input',
            '### Missing Context',
            '- runtime version'
        ].join('\n'));
        expect(sections.map(s => s.name)).toEqual(['Likely Cause', 'Fix Steps', 'Check Next', 'Missing Context']);
    });

    it('parses optimize sections', () => {
        const sections = parseMarkdownSections([
            '### Quick Wins',
            '- remove duplicate branch',
            '### Refactor Suggestions',
            '- split module',
            '### Risk Notes',
            '- behavior drift without tests',
            '### Example Rewrite',
            '- function clean(...)'
        ].join('\n'));
        expect(sections.map(s => s.name)).toEqual(['Quick Wins', 'Refactor Suggestions', 'Risk Notes', 'Example Rewrite']);
    });

    it('ignores markdown separators --- in formatted fields', () => {
        const output = formatDevEmbedContent([
            'Review Summary',
            '---',
            '### Critical',
            '- race condition',
            '---',
            '### Suggestions',
            '- refactor async flow'
        ].join('\n'));
        expect(output.fields.some(f => f.value.includes('---'))).toBe(false);
        expect(output.fields.map(f => f.name)).toEqual(expect.arrayContaining(['Critical', 'Suggestions']));
    });

    it('returns compact response for very short review input', async () => {
        const result = await handleDevReview({}, { code: 'x=1', focus: 'all' }, {});
        expect(result.ok).toBe(true);
        expect(result.text).toBe('Der Code ist zu kurz fuer ein sinnvolles Review.');
    });

    it('truncates long output embed-safe', () => {
        const output = formatDevEmbedContent(`### Critical\n${'a'.repeat(7000)}`);
        expect(output.description.length).toBeLessThanOrEqual(3500);
        if (output.fields[0]) {
            expect(output.fields[0].value.length).toBeLessThanOrEqual(1024);
        }
    });

    it('prioritizes sections and keeps max 4 fields with additional notes', () => {
        const output = formatDevEmbedContent([
            'Summary',
            '### Suggestions',
            '- s',
            '### Next Steps',
            '- n',
            '### Performance',
            '- p',
            '### Security',
            '- sec',
            '### Critical',
            '- c',
            '### Warnings',
            '- w'
        ].join('\n'));

        expect(output.fields.length).toBeLessThanOrEqual(5);
        expect(output.fields[0].name).toBe('Critical');
        expect(output.fields[1].name).toBe('Warnings');
        expect(output.fields[2].name).toBe('Security');
        expect(output.fields[3].name).toBe('Performance');
        expect(output.fields[4].name).toBe('Additional Notes');
        expect(output.fields[4].value).toContain('Suggestions');
        expect(output.fields[4].value).toContain('Next Steps');
    });

    it('keeps single relevant section as single field', () => {
        const output = formatDevEmbedContent([
            'Summary',
            '### Critical',
            '- only one issue'
        ].join('\n'));
        expect(output.fields.length).toBe(1);
        expect(output.fields[0].name).toBe('Critical');
    });

    it('review embed section prioritization remains stable', () => {
        const output = formatDevEmbedContent([
            'Summary',
            '### Suggestions',
            '- s',
            '### Next Steps',
            '- n',
            '### Performance',
            '- p',
            '### Security',
            '- sec',
            '### Critical',
            '- c',
            '### Warnings',
            '- w'
        ].join('\n'));
        const names = output.fields.map(f => f.name);
        expect(names[0]).toBe('Critical');
        expect(names[1]).toBe('Warnings');
    });

    it('redacts secrets in debug prompt input', () => {
        const sanitized = sanitizeCodeInput('api_key=abc123 token=xyz sk-1234567890123456');
        expect(sanitized).not.toContain('abc123');
        expect(sanitized).not.toContain('xyz');
        expect(sanitized).not.toContain('sk-1234567890123456');
    });
});
