const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'User Authentication API',
      version: '1.0.0',
      description: 'Register, login, JWT + refresh tokens, email verification, password reset, and role-based access.'
    },
    // Relative server URL: "Try it out" then targets whatever host served the
    // docs page (LAN IP, tunnel URL, etc.) instead of a hardcoded origin.
    servers: [{ url: '/' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: ['./src/routes/*.js']
};

module.exports = swaggerJsdoc(options);
