import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { TokenService } from '../services/token.service';

export function emailToClientId(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 32);
}

export function oauthRouter(tokenService: TokenService, prisma: PrismaClient): Router {
  const router = Router();

  // OAuth 2.0 Authorization Server Metadata (RFC 8414)
  router.get('/.well-known/oauth-authorization-server', (_req: Request, res: Response) => {
    const baseUrl = process.env.PUBLIC_URL || `${_req.protocol}://${_req.get('host')}`;
    res.json({
      issuer: baseUrl,
      token_endpoint: `${baseUrl}/oauth/token`,
      grant_types_supported: ['client_credentials'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
      response_types_supported: [],
    });
  });

  // OAuth 2.0 Token Endpoint — client credentials grant
  router.post('/oauth/token', async (req: Request, res: Response) => {
    let clientId: string | undefined;
    let clientSecret: string | undefined;

    // Support both Basic auth header and POST body
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Basic ')) {
      const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
      const colonIdx = decoded.indexOf(':');
      if (colonIdx > 0) {
        clientId = decoded.slice(0, colonIdx);
        clientSecret = decoded.slice(colonIdx + 1);
      }
    }

    // POST body takes precedence if present
    if (req.body.client_id) clientId = req.body.client_id;
    if (req.body.client_secret) clientSecret = req.body.client_secret;

    const grantType = req.body.grant_type;

    if (grantType !== 'client_credentials') {
      return res.status(400).json({
        error: 'unsupported_grant_type',
        error_description: 'Only client_credentials grant is supported',
      });
    }

    if (!clientId) {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'client_id is required',
      });
    }

    if (!clientSecret) {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'client_secret is required',
      });
    }

    try {
      // Validate the client_secret as an API token
      const { userId } = await tokenService.validate(clientSecret);

      // Look up the user's email and verify client_id matches its hash
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(401).json({
          error: 'invalid_client',
          error_description: 'Invalid credentials',
        });
      }

      const expectedClientId = emailToClientId(user.email);
      if (clientId !== expectedClientId) {
        return res.status(401).json({
          error: 'invalid_client',
          error_description: 'client_id does not match token owner',
        });
      }

      // The client_secret IS the access token — return it directly.
      // This is a pass-through: the token is already valid for Bearer auth.
      res.json({
        access_token: clientSecret,
        token_type: 'Bearer',
        // No real expiry on API tokens, but OAuth spec expects this
        expires_in: 31536000,
      });
    } catch {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Invalid credentials',
      });
    }
  });

  return router;
}
