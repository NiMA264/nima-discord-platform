const fs = require('fs');
const path = require('path');

function resolveAssetPath(fileName) {
    const candidates = [
        path.join(process.cwd(), fileName),
        path.join(process.cwd(), 'screensshots', fileName)
    ];

    return candidates.find(candidate => fs.existsSync(candidate)) || null;
}

module.exports = { resolveAssetPath };
