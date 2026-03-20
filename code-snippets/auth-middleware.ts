/**
 * JWT Authentication Middleware
 *
 * This module handles secure session management using JWT tokens
 * with HttpOnly cookies for XSS protection.
 *
 * Key Features:
 * - JWT encryption/decryption with jose library
 * - 7-day token expiration with auto-refresh capability
 * - HttpOnly cookies (not accessible via JavaScript)
 * - Role-based access control (RBAC)
 * - Server-side session validation
 */

import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

// Environment variable for JWT secret (min 32 characters recommended)
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-fallback-secret-key-min-32-chars"
);

export const COOKIE_NAME = "kuali_session";

/**
 * Session Payload Interface
 *
 * Contains user identity and authorization information
 */
export interface SessionPayload {
  userId: string;
  email: string;
  role: "CUSTOMER" | "BUSINESS_OWNER" | "ADMIN" | "STAFF";
  businessId?: string; // Optional: For business owners
  emailVerified?: boolean;
  iat?: number; // Issued at (timestamp)
  exp?: number; // Expiration (timestamp)
}

/**
 * Encrypt session data into a JWT token
 *
 * @param payload - User session data
 * @returns Encrypted JWT string
 */
export async function encrypt(payload: SessionPayload): Promise<string> {
  return await new SignJWT(payload as any)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d") // 7 days expiration
    .sign(SECRET);
}

/**
 * Decrypt and verify JWT token
 *
 * @param input - JWT token string
 * @returns Decrypted session payload or null if invalid
 */
export async function decrypt(input: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(input, SECRET, {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch (error) {
    // Token expired, invalid signature, or malformed
    console.error("JWT verification failed:", error);
    return null;
  }
}

/**
 * Create a new session and set HttpOnly cookie
 *
 * Security features:
 * - HttpOnly: Prevents XSS attacks
 * - Secure: HTTPS only in production
 * - SameSite: Prevents CSRF attacks
 *
 * @param payload - User session data
 */
export async function createSession(payload: SessionPayload): Promise<void> {
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const session = await encrypt(payload);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, session, {
    expires,
    httpOnly: true, // Not accessible via JavaScript (XSS protection)
    secure: process.env.NODE_ENV === "production", // HTTPS only in production
    sameSite: "lax", // CSRF protection
    path: "/",
  });
}

/**
 * Get session data from request (Middleware usage)
 *
 * Use this in Next.js middleware for route protection
 *
 * @param req - Next.js request object
 * @returns Session payload or null
 */
export async function getSessionData(
  req: NextRequest
): Promise<SessionPayload | null> {
  const session = req.cookies.get(COOKIE_NAME)?.value;
  if (!session) return null;
  return await decrypt(session);
}

/**
 * Get session data in Server Components/Actions
 *
 * Use this in Server Components and Server Actions
 *
 * @returns Session payload or null
 *
 * @example
 * ```typescript
 * export async function protectedAction() {
 *   const session = await getSession();
 *   if (!session) redirect('/login');
 *
 *   // Use session.userId, session.role, etc.
 * }
 * ```
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_NAME)?.value;
  if (!session) return null;
  return await decrypt(session);
}

/**
 * Destroy session (logout)
 *
 * Removes the session cookie by setting expiration to past date
 */
export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    expires: new Date(0), // Expire immediately
    path: "/",
  });
}

/**
 * Role-based access control helper
 *
 * Validates session and checks if user has required role
 *
 * @param allowedRoles - Array of roles allowed to access
 * @returns Session payload if authorized
 * @throws Error if unauthorized
 *
 * @example
 * ```typescript
 * export async function deleteBusinessAction(id: number) {
 *   const session = await requireRole(['BUSINESS_OWNER', 'ADMIN']);
 *
 *   // Only business owners and admins reach here
 *   await prisma.tableBusiness.delete({ where: { idBusiness: id } });
 * }
 * ```
 */
export async function requireRole(
  allowedRoles: Array<"CUSTOMER" | "BUSINESS_OWNER" | "ADMIN" | "STAFF">
): Promise<SessionPayload> {
  const session = await getSession();

  if (!session) {
    throw new Error("Not authenticated");
  }

  if (!allowedRoles.includes(session.role)) {
    throw new Error(
      `Insufficient permissions. Required: ${allowedRoles.join(" or ")}`
    );
  }

  return session;
}

/**
 * Check if user is authenticated (without throwing error)
 *
 * Useful for conditional rendering
 *
 * @returns true if authenticated, false otherwise
 *
 * @example
 * ```typescript
 * export async function DashboardPage() {
 *   const isAuthenticated = await isLoggedIn();
 *
 *   if (!isAuthenticated) {
 *     redirect('/login');
 *   }
 *
 *   return <Dashboard />;
 * }
 * ```
 */
export async function isLoggedIn(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}

/**
 * Refresh session expiration
 *
 * Extends session lifetime by creating a new token with updated expiration
 * Useful for "remember me" functionality
 *
 * @returns true if refreshed, false if no session exists
 */
export async function refreshSession(): Promise<boolean> {
  const session = await getSession();

  if (!session) {
    return false;
  }

  // Create new session with same data but fresh expiration
  await createSession(session);
  return true;
}

/**
 * Update session data (e.g., after role change)
 *
 * @param updates - Partial session payload to merge
 */
export async function updateSession(
  updates: Partial<SessionPayload>
): Promise<void> {
  const session = await getSession();

  if (!session) {
    throw new Error("No session to update");
  }

  await createSession({ ...session, ...updates });
}

/**
 * Example: Next.js Middleware for Route Protection
 *
 * Place this in `middleware.ts` at the root of your project
 *
 * ```typescript
 * import { NextResponse } from 'next/server';
 * import type { NextRequest } from 'next/server';
 * import { getSessionData } from '@/lib/auth';
 *
 * export async function middleware(request: NextRequest) {
 *   const session = await getSessionData(request);
 *
 *   // Protect /dashboard routes
 *   if (request.nextUrl.pathname.startsWith('/dashboard')) {
 *     if (!session) {
 *       return NextResponse.redirect(new URL('/login', request.url));
 *     }
 *
 *     // Business owners only
 *     if (session.role !== 'BUSINESS_OWNER' && session.role !== 'ADMIN') {
 *       return NextResponse.redirect(new URL('/unauthorized', request.url));
 *     }
 *   }
 *
 *   return NextResponse.next();
 * }
 *
 * export const config = {
 *   matcher: ['/dashboard/:path*'],
 * };
 * ```
 */

// ────────────────────────────────────────────────────────────────────────────
// Security Notes:
// ────────────────────────────────────────────────────────────────────────────
//
// 1. JWT_SECRET should be:
//    - Minimum 32 characters
//    - Cryptographically random
//    - Stored in environment variables, NEVER committed to git
//
// 2. HttpOnly cookies prevent XSS attacks:
//    - JavaScript cannot access the token
//    - Even if attacker injects malicious script, they can't steal the session
//
// 3. Secure flag ensures HTTPS:
//    - Token only sent over encrypted connections in production
//
// 4. SameSite=lax prevents CSRF:
//    - Cookie not sent on cross-site POST requests
//
// 5. 7-day expiration balances security and UX:
//    - Long enough to avoid constant re-login
//    - Short enough to limit damage if token stolen
//    - Consider implementing refresh tokens for longer sessions
//
// 6. Token validation on every request:
//    - Expired tokens automatically rejected
//    - Invalid signatures detected
//    - Prevents token tampering
//
// ────────────────────────────────────────────────────────────────────────────
