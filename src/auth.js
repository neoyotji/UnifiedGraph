/**
 * Authentication & User Management
 * ---------------------------------
 * JWT tabanlı kimlik doğrulama sistemi
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// JWT Secret (Production'da environment variable kullanın)
const JWT_SECRET = process.env.JWT_SECRET || 'unified-graph-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

// In-memory kullanıcı veritabanı (Demo amaçlı)
// Production'da gerçek veritabanı kullanın
const users = new Map([
    ['admin', {
        id: '1',
        username: 'admin',
        password: '$2a$10$rQnM1qO7xK.4wJvJ8vPZPeQzPO8HjKj8N6dK4kL.H5vX6Y7Z8A9BC', // admin123
        role: 'admin',
        name: 'System Admin',
        createdAt: new Date().toISOString()
    }],
    ['user1', {
        id: '2',
        username: 'user1',
        password: '$2a$10$rQnM1qO7xK.4wJvJ8vPZPeQzPO8HjKj8N6dK4kL.H5vX6Y7Z8A9BC', // user123
        role: 'user',
        name: 'Demo User',
        createdAt: new Date().toISOString()
    }]
]);

// Sorgu logları (In-memory, CloudWatch'a da gönderilir)
const queryLogs = [];

/**
 * Şifre hash'leme
 */
async function hashPassword(password) {
    return bcrypt.hash(password, 10);
}

/**
 * Şifre doğrulama
 */
async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

/**
 * JWT token oluşturma
 */
function generateToken(user) {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            role: user.role,
            name: user.name
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

/**
 * JWT token doğrulama
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

/**
 * Kullanıcı login
 */
async function loginUser(username, password) {
    const user = users.get(username);
    if (!user) {
        throw new Error('Kullanıcı bulunamadı');
    }

    // Demo için basit şifre kontrolü
    const validPasswords = {
        'admin': 'admin123',
        'user1': 'user123'
    };

    if (password !== validPasswords[username]) {
        throw new Error('Geçersiz şifre');
    }

    const token = generateToken(user);
    return {
        token,
        user: {
            id: user.id,
            username: user.username,
            role: user.role,
            name: user.name
        }
    };
}

/**
 * Kullanıcı kayıt
 */
async function registerUser(username, password, name) {
    if (users.has(username)) {
        throw new Error('Kullanıcı adı zaten mevcut');
    }

    const hashedPassword = await hashPassword(password);
    const newUser = {
        id: String(users.size + 1),
        username,
        password: hashedPassword,
        role: 'user',
        name,
        createdAt: new Date().toISOString()
    };

    users.set(username, newUser);
    return generateToken(newUser);
}

/**
 * Sorgu loglama
 */
function logQuery(userId, username, role, query, operationName, duration, success, error = null) {
    const logEntry = {
        id: queryLogs.length + 1,
        timestamp: new Date().toISOString(),
        userId,
        username,
        role,
        query: query.substring(0, 500), // İlk 500 karakter
        operationName: operationName || 'anonymous',
        duration,
        success,
        error: error ? error.message : null,
        clientIp: 'localhost' // Request'ten alınabilir
    };

    queryLogs.push(logEntry);

    // Son 1000 log tut
    if (queryLogs.length > 1000) {
        queryLogs.shift();
    }

    // Console'a da log (CloudWatch Agent tarafından yakalanır)
    console.log(JSON.stringify({
        type: 'QUERY_LOG',
        ...logEntry
    }));

    return logEntry;
}

/**
 * Admin için sorgu loglarını getir
 */
function getQueryLogs(filterUserId = null, limit = 100) {
    let logs = [...queryLogs].reverse();

    if (filterUserId) {
        logs = logs.filter(log => log.userId === filterUserId);
    }

    return logs.slice(0, limit);
}

/**
 * Tüm kullanıcıları getir (admin için)
 */
function getAllUsers() {
    return Array.from(users.values()).map(user => ({
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        createdAt: user.createdAt
    }));
}

/**
 * Kullanıcı istatistikleri
 */
function getUserStats() {
    const stats = {};
    queryLogs.forEach(log => {
        if (!stats[log.username]) {
            stats[log.username] = { total: 0, success: 0, failed: 0 };
        }
        stats[log.username].total++;
        if (log.success) {
            stats[log.username].success++;
        } else {
            stats[log.username].failed++;
        }
    });
    return stats;
}

module.exports = {
    loginUser,
    registerUser,
    verifyToken,
    logQuery,
    getQueryLogs,
    getAllUsers,
    getUserStats,
    JWT_SECRET
};
