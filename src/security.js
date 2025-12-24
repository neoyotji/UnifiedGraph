/**
 * Security Middleware & Plugins
 * -----------------------------
 * GraphQL güvenlik katmanları
 */

const depthLimit = require('graphql-depth-limit');
const { createComplexityLimitRule } = require('graphql-validation-complexity');
const config = require('./config');

/**
 * Query Depth Limiting Plugin
 * N+1 ve derin nested sorguları engeller
 */
const createDepthLimitPlugin = () => {
    return depthLimit(config.security.queryDepthLimit, {
        ignore: ['__schema', '__type'] // Introspection'a izin ver
    });
};

/**
 * Query Complexity Plugin
 * Karmaşık sorguları sınırlar
 */
const createComplexityPlugin = () => {
    return createComplexityLimitRule(config.security.queryComplexityLimit, {
        onCost: (cost) => {
            if (config.logging.enableAudit) {
                console.log(`[Security] Query complexity: ${cost}`);
            }
        },
        createError: (max, actual) => {
            return new Error(`Query complexity ${actual} exceeds maximum allowed ${max}`);
        },
    });
};

/**
 * Security Audit Logger
 * Güvenlik olaylarını loglar
 */
const createAuditPlugin = () => {
    return {
        async requestDidStart(requestContext) {
            const startTime = Date.now();
            const clientIp = requestContext.request.http?.headers?.get('x-forwarded-for') || 'unknown';

            return {
                async didEncounterErrors(ctx) {
                    if (config.logging.enableAudit) {
                        console.log(JSON.stringify({
                            timestamp: new Date().toISOString(),
                            type: 'SECURITY_AUDIT',
                            event: 'QUERY_ERROR',
                            clientIp,
                            operationName: ctx.request.operationName || 'anonymous',
                            errors: ctx.errors.map(e => ({
                                message: e.message,
                                path: e.path,
                            })),
                        }));
                    }
                },
                async willSendResponse(ctx) {
                    const duration = Date.now() - startTime;

                    if (config.logging.enableAudit) {
                        console.log(JSON.stringify({
                            timestamp: new Date().toISOString(),
                            type: 'SECURITY_AUDIT',
                            event: 'REQUEST_COMPLETE',
                            clientIp,
                            operationName: ctx.request.operationName || 'anonymous',
                            duration,
                            hasErrors: ctx.errors && ctx.errors.length > 0,
                        }));
                    }
                },
            };
        },
    };
};

/**
 * Rate Limit Error Handler
 * Rate limit aşıldığında GraphQL formatında hata döner
 */
const rateLimitHandler = (req, res) => {
    res.status(429).json({
        errors: [{
            message: config.rateLimit.message,
            extensions: {
                code: 'RATE_LIMITED',
                retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
            },
        }],
    });
};

/**
 * Introspection Control Plugin
 * Production'da introspection'ı devre dışı bırakır
 */
const createIntrospectionPlugin = () => {
    if (config.security.enableIntrospection) {
        return null;
    }

    return {
        async requestDidStart() {
            return {
                async didResolveOperation(ctx) {
                    const query = ctx.request.query || '';
                    if (query.includes('__schema') || query.includes('__type')) {
                        throw new Error('GraphQL introspection is disabled in production');
                    }
                },
            };
        },
    };
};

/**
 * Blocked Field Plugin
 * Hassas alanları engelleyebilir
 */
const createFieldBlockerPlugin = (blockedFields = []) => {
    if (blockedFields.length === 0) return null;

    return {
        async requestDidStart() {
            return {
                async didResolveOperation(ctx) {
                    const query = ctx.request.query || '';
                    for (const field of blockedFields) {
                        if (query.includes(field)) {
                            throw new Error(`Access to field '${field}' is not allowed`);
                        }
                    }
                },
            };
        },
    };
};

module.exports = {
    createDepthLimitPlugin,
    createComplexityPlugin,
    createAuditPlugin,
    createIntrospectionPlugin,
    createFieldBlockerPlugin,
    rateLimitHandler,
};
