#!/usr/bin/env python3
import sys

with open('/opt/openclaw/server.cjs', 'r') as f:
    content = f.read()

# 1. Add the require statement after http require
if 'handleApiRequest' not in content:
    content = content.replace(
        "const http = require('http');",
        "const http = require('http');\nconst { handleApiRequest } = require('./api.cjs');"
    )
    print('[PATCH] Added API require')
else:
    print('[SKIP] API require already present')

# 2. Add API route interception before static file serving
if '/api/' not in content or 'handleApiRequest(req, res)' not in content.split('createServer')[1]:
    old = "    let filePath = path.join(DIST_DIR"
    new = """    // --- REST API Routes ---
    if (req.url.startsWith('/api/') || req.url === '/api') {
        handleApiRequest(req, res);
        return;
    }

    let filePath = path.join(DIST_DIR"""
    content = content.replace(old, new, 1)
    print('[PATCH] Added API route interception')
else:
    print('[SKIP] API routes already present')

with open('/opt/openclaw/server.cjs', 'w') as f:
    f.write(content)

print('[DONE] server.cjs patched successfully')
