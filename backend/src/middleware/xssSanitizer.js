const xss = require('xss');

// Configure XSS to allow some safe HTML tags if needed, or strip everything.
// Here we allow standard text formatting but strip scripts, iframes, etc.
const xssOptions = {
    whiteList: {
        a: ['href', 'title', 'target'],
        b: [],
        i: [],
        strong: [],
        em: [],
        p: [],
        br: [],
        ul: [],
        ol: [],
        li: [],
        span: ['data-type', 'data-id', 'class', 'style'] // Allow mention spans
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style', 'iframe'] // Completely remove these tags and their content
};

const sanitize = (obj) => {
    if (typeof obj === 'string') {
        return xss(obj, xssOptions);
    }
    if (Array.isArray(obj)) {
        return obj.map(item => sanitize(item));
    }
    if (typeof obj === 'object' && obj !== null) {
        const sanitizedObj = {};
        for (const [key, value] of Object.entries(obj)) {
            sanitizedObj[key] = sanitize(value);
        }
        return sanitizedObj;
    }
    return obj;
};

const xssSanitizer = (req, res, next) => {
    if (req.body) req.body = sanitize(req.body);
    if (req.query) req.query = sanitize(req.query);
    if (req.params) req.params = sanitize(req.params);
    next();
};

module.exports = xssSanitizer;
