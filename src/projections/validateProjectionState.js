const githubActivitySchema = require('./contracts/v1/github-activity-read-model.schema.json');
const contributionSchema = require('./contracts/v1/contribution-read-model.schema.json');

const schemaByName = {
    githubActivity: githubActivitySchema,
    contribution: contributionSchema
};

function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function checkType(value, type) {
    if (type === 'array') return Array.isArray(value);
    if (type === 'object') return isObject(value);
    if (type === 'integer') return Number.isInteger(value);
    if (type === 'string') return typeof value === 'string';
    return true;
}

function validateAgainstSchema(value, schema, path = 'state') {
    const errors = [];
    const current = value;

    if (schema?.required && Array.isArray(schema.required)) {
        for (const key of schema.required) {
            if (!(key in (current || {}))) {
                errors.push(`${path}.${key} is required`);
            }
        }
    }

    if (schema?.type && !checkType(current, schema.type)) {
        errors.push(`${path} must be ${schema.type}`);
        return errors;
    }

    if (schema?.type === 'object' && isObject(current) && isObject(schema.properties)) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
            if (!(key in current)) continue;
            const nextPath = `${path}.${key}`;
            errors.push(...validateAgainstSchema(current[key], propSchema, nextPath));
        }
    }

    if (schema?.type === 'array' && Array.isArray(current) && schema.items) {
        current.forEach((item, index) => {
            errors.push(...validateAgainstSchema(item, schema.items, `${path}[${index}]`));
        });
    }

    if (schema?.type === 'integer' && Number.isInteger(current) && Number.isInteger(schema.minimum) && current < schema.minimum) {
        errors.push(`${path} must be >= ${schema.minimum}`);
    }

    if (schema && Object.prototype.hasOwnProperty.call(schema, 'const') && current !== schema.const) {
        errors.push(`${path} must equal ${schema.const}`);
    }

    return errors;
}

function validateProjectionState(contractName, state) {
    const schema = schemaByName[String(contractName || '').trim()];
    if (!schema) {
        return {
            valid: false,
            errors: [`unknown projection contract: ${contractName}`]
        };
    }

    const errors = validateAgainstSchema(state, schema);
    return {
        valid: errors.length === 0,
        errors
    };
}

module.exports = {
    validateProjectionState
};
