import { Router, Request, Response } from 'express';
import { PrismaClient, User } from '@prisma/client';
import crypto from 'crypto';
import { TokenService } from '../services/token.service';

export function emailToClientId(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 32);
}

// --- In-memory authorization code store ---
interface AuthCode {
  userId: number;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  expiresAt: number;
}

const authCodes = new Map<string, AuthCode>();

// Cleanup expired codes every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of authCodes) {
    if (data.expiresAt < now) authCodes.delete(code);
  }
}, 5 * 60 * 1000);

function generateAuthCode(): string {
  return crypto.randomBytes(32).toString('hex');
}

function verifyPkceS256(codeVerifier: string, codeChallenge: string): boolean {
  const hash = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  return hash === codeChallenge;
}

export function oauthRouter(tokenService: TokenService, prisma: PrismaClient): Router {
  const router = Router();

  // OAuth 2.0 Authorization Server Metadata (RFC 8414)
  router.get('/.well-known/oauth-authorization-server', (_req: Request, res: Response) => {
    const baseUrl = process.env.PUBLIC_URL || `${_req.protocol}://${_req.get('host')}`;
    res.json({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      grant_types_supported: ['authorization_code', 'client_credentials'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
      response_types_supported: ['code'],
      code_challenge_methods_supported: ['S256'],
    });
  });

  // OAuth 2.0 Authorization Endpoint
  router.get('/oauth/authorize', (req: Request, res: Response) => {
    const { client_id, redirect_uri, state, code_challenge, code_challenge_method, response_type } = req.query as Record<string, string>;

    if (response_type && response_type !== 'code') {
      return res.status(400).json({
        error: 'unsupported_response_type',
        error_description: 'Only response_type=code is supported',
      });
    }

    if (!redirect_uri) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'redirect_uri is required',
      });
    }

    // If user is not logged in, stash params and redirect to Google login
    if (!req.user) {
      req.session.pendingOAuth = {
        client_id: client_id || '',
        redirect_uri,
        state,
        code_challenge,
        code_challenge_method,
      };
      return req.session.save(() => {
        res.redirect('/api/auth/google');
      });
    }

    // User is logged in — generate authorization code
    const user = req.user as User;
    const code = generateAuthCode();
    authCodes.set(code, {
      userId: user.id,
      clientId: client_id || emailToClientId(user.email),
      redirectUri: redirect_uri,
      codeChallenge: code_challenge || '',
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    });

    // Build redirect URL with code and state
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', code);
    if (state) redirectUrl.searchParams.set('state', state);
    res.redirect(redirectUrl.toString());
  });

  // OAuth 2.0 Token Endpoint
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

    // --- Authorization code grant ---
    if (grantType === 'authorization_code') {
      const { code, code_verifier, redirect_uri } = req.body;

      if (!code) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'code is required',
        });
      }

      const authCode = authCodes.get(code);
      if (!authCode) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Invalid or expired authorization code',
        });
      }

      // Single-use: delete immediately
      authCodes.delete(code);

      // Check expiry
      if (authCode.expiresAt < Date.now()) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Authorization code has expired',
        });
      }

      // Verify redirect_uri matches
      if (redirect_uri && redirect_uri !== authCode.redirectUri) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'redirect_uri mismatch',
        });
      }

      // PKCE verification (required if code_challenge was provided)
      if (authCode.codeChallenge) {
        if (!code_verifier) {
          return res.status(400).json({
            error: 'invalid_request',
            error_description: 'code_verifier is required',
          });
        }
        if (!verifyPkceS256(code_verifier, authCode.codeChallenge)) {
          return res.status(400).json({
            error: 'invalid_grant',
            error_description: 'PKCE code_verifier failed verification',
          });
        }
      }

      // Create a real API token for the user
      try {
        const user = await prisma.user.findUnique({ where: { id: authCode.userId } });
        if (!user) {
          return res.status(400).json({
            error: 'invalid_grant',
            error_description: 'User not found',
          });
        }

        const tokenResult = await tokenService.create(user.id, 'oauth');
        res.json({
          access_token: tokenResult.token,
          token_type: 'Bearer',
          expires_in: 31536000,
        });
      } catch {
        return res.status(500).json({
          error: 'server_error',
          error_description: 'Failed to create access token',
        });
      }
      return;
    }

    // --- Client credentials grant ---
    if (grantType === 'client_credentials') {
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
        res.json({
          access_token: clientSecret,
          token_type: 'Bearer',
          expires_in: 31536000,
        });
      } catch {
        return res.status(401).json({
          error: 'invalid_client',
          error_description: 'Invalid credentials',
        });
      }
      return;
    }

    // Unsupported grant type
    return res.status(400).json({
      error: 'unsupported_grant_type',
      error_description: 'Supported grant types: authorization_code, client_credentials',
    });
  });

  return router;
}
