const express = require('express');
const path = require('path');
const { ApolloServer, gql } = require('apollo-server-express');
const axios = require('axios');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const { userLoader } = require('./loaders');
const config = require('./config');
const {
  createDepthLimitPlugin,
  createComplexityPlugin,
  createAuditPlugin,
  createIntrospectionPlugin,
  rateLimitHandler,
} = require('./security');
const {
  loginUser,
  registerUser,
  verifyToken,
  logQuery,
  getQueryLogs,
  getAllUsers,
  getUserStats
} = require('./auth');

// Şema Tasarımı
const typeDefs = gql`
  type User {
    id: ID!
    name: String!
    username: String!
    email: String!
    company: Company
  }

  type Company {
    name: String
    catchPhrase: String
  }

  type Post {
    id: ID!
    title: String!
    body: String!
    user: User
  }

  type HealthCheck {
    status: String!
    timestamp: String!
    environment: String!
  }

  # Authentication Types
  type AuthPayload {
    token: String!
    user: AuthUser!
  }

  type AuthUser {
    id: ID!
    username: String!
    role: String!
    name: String!
  }

  type QueryLog {
    id: Int!
    timestamp: String!
    userId: String!
    username: String!
    role: String!
    query: String!
    operationName: String
    duration: Int!
    success: Boolean!
    error: String
  }

  type UserStats {
    username: String!
    total: Int!
    success: Int!
    failed: Int!
  }

  type SystemUser {
    id: ID!
    username: String!
    role: String!
    name: String!
    createdAt: String!
  }

  type Query {
    # Public
    posts: [Post]
    users: [User]
    health: HealthCheck
    
    # Authenticated
    me: AuthUser
    
    # Admin Only
    queryLogs(userId: String, limit: Int): [QueryLog]
    allUsers: [SystemUser]
    userStats: [UserStats]
  }

  type Mutation {
    # Authentication
    login(username: String!, password: String!): AuthPayload!
    register(username: String!, password: String!, name: String!): AuthPayload!
  }
`;

// Resolver Mantığı
const resolvers = {
  Query: {
    posts: async () => {
      const response = await axios.get('https://jsonplaceholder.typicode.com/posts');
      return response.data.slice(0, 20);
    },
    users: async () => {
      const response = await axios.get('https://jsonplaceholder.typicode.com/users');
      return response.data;
    },
    health: () => ({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
    }),

    // Authenticated: Kullanıcı bilgisi
    me: (_, __, { user }) => {
      if (!user) {
        throw new Error('Giriş yapmanız gerekiyor');
      }
      return user;
    },

    // Sorgu logları - Admin herşeyi görür, user sadece kendini görür
    queryLogs: (_, { userId, limit = 100 }, { user }) => {
      if (!user) {
        throw new Error('Giriş yapmanız gerekiyor');
      }
      // Admin herşeyi görebilir
      if (user.role === 'admin') {
        return getQueryLogs(userId, limit);
      }
      // Normal kullanıcı sadece kendi loglarını görebilir
      return getQueryLogs(user.id, limit);
    },

    // Admin Only: Tüm kullanıcılar
    allUsers: (_, __, { user }) => {
      if (!user || user.role !== 'admin') {
        throw new Error('Bu işlem için admin yetkisi gerekiyor');
      }
      return getAllUsers();
    },

    // Admin Only: Kullanıcı istatistikleri
    userStats: (_, __, { user }) => {
      if (!user || user.role !== 'admin') {
        throw new Error('Bu işlem için admin yetkisi gerekiyor');
      }
      const stats = getUserStats();
      return Object.entries(stats).map(([username, data]) => ({
        username,
        ...data
      }));
    },
  },

  Mutation: {
    login: async (_, { username, password }) => {
      return loginUser(username, password);
    },
    register: async (_, { username, password, name }) => {
      const token = await registerUser(username, password, name);
      const userData = verifyToken(token);
      return {
        token,
        user: userData
      };
    },
  },

  Post: {
    user: (parent) => {
      return userLoader.load(parent.userId);
    },
  },
};

// Query Loglama Plugin
const createQueryLogPlugin = () => ({
  async requestDidStart(requestContext) {
    const startTime = Date.now();
    const user = requestContext.context?.user;

    return {
      async willSendResponse(ctx) {
        const duration = Date.now() - startTime;
        const query = ctx.request.query || '';

        // Login/register mutation'larını logla, şifreleri gizle
        const sanitizedQuery = query.replace(/password:\s*"[^"]*"/g, 'password: "***"');

        logQuery(
          user?.id || 'anonymous',
          user?.username || 'anonymous',
          user?.role || 'guest',
          sanitizedQuery,
          ctx.request.operationName,
          duration,
          !ctx.errors || ctx.errors.length === 0,
          ctx.errors?.[0]
        );
      },
    };
  },
});

async function startServer() {
  const app = express();

  // ========================================
  // SECURITY MIDDLEWARE
  // ========================================

  // Helmet: HTTP güvenlik başlıkları
  // NOT: Demo arayüzü için CSP geçici olarak kapalı
  // Production'da aşağıdaki yorum satırlarını aktif edin
  app.use(helmet({
    contentSecurityPolicy: false, // Demo için kapalı
    crossOriginEmbedderPolicy: false,
  }));

  // Static files (sunum arayüzü)
  app.use(express.static(path.join(__dirname, '../public')));

  // CORS yapılandırması
  app.use(cors(config.cors));

  // Rate Limiting (WAF yerine Free Tier çözümü)
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: config.rateLimit.standardHeaders,
    legacyHeaders: config.rateLimit.legacyHeaders,
    handler: rateLimitHandler,
    skip: (req) => {
      return req.path === '/health';
    },
  });
  app.use('/graphql', limiter);

  // ========================================
  // APOLLO SERVER
  // ========================================

  const plugins = [
    createAuditPlugin(),
    createQueryLogPlugin(), // Kullanıcı sorgu loglama
  ];

  const introspectionPlugin = createIntrospectionPlugin();
  if (introspectionPlugin) {
    plugins.push(introspectionPlugin);
  }

  const validationRules = [
    createDepthLimitPlugin(),
    createComplexityPlugin(),
  ];

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    plugins,
    validationRules,
    introspection: config.security.enableIntrospection,
    formatError: (error) => {
      if (config.isProduction) {
        return {
          message: error.message,
          extensions: {
            code: error.extensions?.code || 'INTERNAL_SERVER_ERROR',
          },
        };
      }
      return error;
    },
    context: ({ req }) => {
      // JWT token'dan kullanıcı bilgisini çıkar
      const authHeader = req.headers.authorization || '';
      const token = authHeader.replace('Bearer ', '');
      const user = token ? verifyToken(token) : null;

      return {
        loaders: {
          user: userLoader,
        },
        user,
        clientIp: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      };
    },
  });

  await server.start();

  server.applyMiddleware({
    app,
    path: '/graphql',
    cors: false,
  });

  // ========================================
  // HEALTH CHECK ENDPOINT
  // ========================================
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
    });
  });

  // ========================================
  // START SERVER
  // ========================================
  app.listen(config.port, () => {
    console.log(`🚀 Gateway ready at http://localhost:${config.port}${server.graphqlPath}`);
    console.log(`📊 Environment: ${config.nodeEnv}`);
    console.log(`🔒 Introspection: ${config.security.enableIntrospection ? 'enabled' : 'disabled'}`);
    console.log(`⚡ Rate limit: ${config.rateLimit.max} requests per ${config.rateLimit.windowMs / 1000}s`);
    console.log(`👤 Demo users: admin/admin123, user1/user123`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});