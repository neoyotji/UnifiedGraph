/**
 * Application Configuration
 * -------------------------
 * Environment-based yapılandırma
 */

const config = {
  // Environment
  isProduction: process.env.NODE_ENV === 'production',
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 4000,

  // GraphQL Security
  security: {
    // Introspection: Development'ta açık, production'da kapalı
    enableIntrospection: process.env.NODE_ENV !== 'production',
    
    // Query depth limit - derin nested sorgulara karşı koruma
    queryDepthLimit: parseInt(process.env.QUERY_DEPTH_LIMIT, 10) || 7,
    
    // Query complexity limit - karmaşık sorgulara karşı koruma
    queryComplexityLimit: parseInt(process.env.QUERY_COMPLEXITY_LIMIT, 10) || 1000,
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 dakika
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100, // pencere başına max istek
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  },

  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN || '*', // Production'da spesifik domain
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableAudit: process.env.ENABLE_AUDIT_LOG !== 'false',
  },
};

module.exports = config;
