// This file runs before any test modules are loaded (via Jest setupFiles)
// so env vars are available when NestJS ConfigModule.forRoot() validates them.
process.env['DB_TYPE'] = 'memory'
process.env['CACHE_TYPE'] = 'memory'
process.env['ADMIN_SECRET'] = 'test-admin-secret-ok'
process.env['ENCRYPTION_KEY'] = 'a'.repeat(64)
process.env['JWT_DEFAULT_TTL'] = '3600'
process.env['LOG_LEVEL'] = 'error'
process.env['RATE_LIMIT_LIMIT'] = '1000'
process.env['RATE_LIMIT_TTL'] = '60000'
process.env['METRICS_ALLOWED_IPS'] = '127.0.0.1,::1,::ffff:127.0.0.1'
