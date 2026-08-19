/* ==========================================================================
   cognito.js — Amazon Cognito OAuth 2.0 PKCE authentication.
   
   Uses Cognito Hosted UI for sign-in/sign-up, handles callback,
   and manages tokens in localStorage.
   
   No external dependencies — pure browser APIs (crypto.subtle for PKCE).
   ========================================================================== */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const COGNITO_CONFIG = {
  region: 'us-east-1',
  userPoolId: 'us-east-1_5DUIC6JWg',
  clientId: 'qf007fk1kebmc03elg9cvjsnq',
  hostedUiDomain: 'https://us-east-15duic6jwg.auth.us-east-1.amazoncognito.com',
  redirectUri: window.location.origin,  // http://localhost:3000 in dev
  scopes: 'openid email',
};

const TOKEN_KEY = 'gravity.cognito.tokens';
const PKCE_KEY = 'gravity.cognito.pkce';

// ---------------------------------------------------------------------------
// PKCE helpers (using Web Crypto API)
// ---------------------------------------------------------------------------

function generateRandomString(length = 64) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, length);
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return hash;
}

function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generatePKCE() {
  const verifier = generateRandomString(64);
  const challengeBuffer = await sha256(verifier);
  const challenge = base64UrlEncode(challengeBuffer);
  return { verifier, challenge };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Redirect the user to Cognito Hosted UI for sign-in.
 */
export async function signInWithCognito() {
  const { verifier, challenge } = await generatePKCE();
  
  // Store verifier for the callback
  sessionStorage.setItem(PKCE_KEY, verifier);
  
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: COGNITO_CONFIG.clientId,
    redirect_uri: COGNITO_CONFIG.redirectUri,
    scope: COGNITO_CONFIG.scopes,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });
  
  window.location.href = `${COGNITO_CONFIG.hostedUiDomain}/oauth2/authorize?${params.toString()}`;
}

/**
 * Check if the current URL contains a Cognito callback code.
 * If so, exchange it for tokens.
 * Returns the user info if successful, null otherwise.
 */
export async function handleCallback() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  
  if (error) {
    console.error('[Cognito] Auth error:', error, url.searchParams.get('error_description'));
    // Clean up URL
    window.history.replaceState({}, '', url.pathname + url.hash);
    return null;
  }
  
  if (!code) return null;
  
  const verifier = sessionStorage.getItem(PKCE_KEY);
  if (!verifier) {
    console.error('[Cognito] No PKCE verifier found');
    window.history.replaceState({}, '', url.pathname + url.hash);
    return null;
  }
  
  // Exchange code for tokens
  try {
    const tokenResponse = await fetch(`${COGNITO_CONFIG.hostedUiDomain}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: COGNITO_CONFIG.clientId,
        code,
        redirect_uri: COGNITO_CONFIG.redirectUri,
        code_verifier: verifier,
      }),
    });
    
    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      console.error('[Cognito] Token exchange failed:', errBody);
      return null;
    }
    
    const tokens = await tokenResponse.json();
    
    // Store tokens
    localStorage.setItem(TOKEN_KEY, JSON.stringify({
      accessToken: tokens.access_token,
      idToken: tokens.id_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + (tokens.expires_in * 1000),
    }));
    
    // Clean up
    sessionStorage.removeItem(PKCE_KEY);
    window.history.replaceState({}, '', url.pathname + url.hash);
    
    // Decode ID token to get user info
    return parseIdToken(tokens.id_token);
    
  } catch (err) {
    console.error('[Cognito] Token exchange error:', err);
    return null;
  }
}

/**
 * Get the current authenticated user from stored tokens.
 * Returns user info object or null if not authenticated.
 */
export function getCurrentUser() {
  try {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) return null;
    
    const tokens = JSON.parse(stored);
    
    // Check expiry
    if (tokens.expiresAt && Date.now() > tokens.expiresAt) {
      // Token expired — clear and return null
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    
    if (!tokens.idToken) return null;
    return parseIdToken(tokens.idToken);
    
  } catch {
    return null;
  }
}

/**
 * Get the current access token (for API calls if needed).
 */
export function getAccessToken() {
  try {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) return null;
    const tokens = JSON.parse(stored);
    if (tokens.expiresAt && Date.now() > tokens.expiresAt) return null;
    return tokens.accessToken || null;
  } catch {
    return null;
  }
}

/**
 * Get the current ID token (for verifying identity).
 */
export function getIdToken() {
  try {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) return null;
    const tokens = JSON.parse(stored);
    if (tokens.expiresAt && Date.now() > tokens.expiresAt) return null;
    return tokens.idToken || null;
  } catch {
    return null;
  }
}

/**
 * Sign out — clear local tokens and redirect to Cognito logout.
 */
export function signOutCognito() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(PKCE_KEY);
  
  const params = new URLSearchParams({
    client_id: COGNITO_CONFIG.clientId,
    logout_uri: COGNITO_CONFIG.redirectUri,
  });
  
  window.location.href = `${COGNITO_CONFIG.hostedUiDomain}/logout?${params.toString()}`;
}

/**
 * Check if user is authenticated via Cognito.
 */
export function isAuthenticated() {
  return getCurrentUser() !== null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Decode a JWT ID token payload (no signature verification — that's the backend's job).
 */
function parseIdToken(idToken) {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    
    return {
      id: payload.sub,
      email: payload.email || '',
      name: payload.name || payload.email?.split('@')[0] || 'Student',
      cognitoUsername: payload['cognito:username'] || '',
      emailVerified: payload.email_verified || false,
    };
  } catch {
    return null;
  }
}
