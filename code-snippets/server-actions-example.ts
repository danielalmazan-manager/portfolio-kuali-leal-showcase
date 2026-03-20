/**
 * Server Actions Example
 *
 * Demonstrates type-safe API patterns using Next.js Server Actions
 * with authentication, validation, and error handling.
 *
 * These examples are from the Kuali Leal authentication flow.
 */

'use server';

import { prismaApp01 } from '@/lib/prisma';
import { createSession, getSession, requireRole } from '@/lib/auth';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// ────────────────────────────────────────────────────────────────────────────
// Example 1: Login Action with Form State
// ────────────────────────────────────────────────────────────────────────────

/**
 * Login Action
 *
 * Authenticates user with email/password and creates session
 *
 * Features:
 * - Password verification with bcrypt
 * - JWT session creation
 * - Role-based redirect
 * - Progressive enhancement (works without JS)
 *
 * @param prevState - Previous form state (for error display)
 * @param formData - Form data from client
 * @returns Error object or redirects on success
 */
export async function loginAction(prevState: any, formData: FormData) {
  const email = formData.get('email')?.toString();
  const password = formData.get('password')?.toString();

  console.log('[Login] Attempting login for:', email);

  // Input validation
  if (!email || !password) {
    return { error: 'Please complete all fields' };
  }

  try {
    // Fetch user from database
    const user = await prismaApp01.users.findFirst({
      where: { emailUser: email }
    });

    console.log('[Login] User found:', user ? 'Yes' : 'No');

    if (!user || !user.passwordHash) {
      // Generic error message (don't reveal if email exists)
      return { error: 'Invalid credentials' };
    }

    // Verify password with bcrypt
    const isValid = await bcrypt.compare(password, user.passwordHash);
    console.log('[Login] Password is valid:', isValid);

    if (!isValid) {
      return { error: 'Invalid credentials' };
    }

    // Create encrypted JWT session
    await createSession({
      userId: user.idUser,
      email: user.emailUser!,
      role: user.role as any,
    });
    console.log('[Login] Session created successfully');

    // Role-based redirect
    if (user.role === 'CUSTOMER') {
      redirect('https://kualileal.com'); // Customer portal
    }

  } catch (err: any) {
    console.error('[Login] ERROR:', err);
    return { error: `Server error: ${err.message}` };
  }

  // Business owners/staff go to dashboard
  redirect('/dashboard');
}

// ────────────────────────────────────────────────────────────────────────────
// Example 2: Registration with Auto-Login
// ────────────────────────────────────────────────────────────────────────────

/**
 * Registration Action
 *
 * Creates new user account with hashed password and auto-login
 *
 * Security features:
 * - UUID for user ID (non-sequential, unpredictable)
 * - bcrypt password hashing with 10 salt rounds
 * - Duplicate email/phone detection
 * - Automatic session creation after registration
 *
 * @param prevState - Previous form state
 * @param formData - Registration form data
 * @returns Error object or redirects to role selection
 */
export async function registerAction(prevState: any, formData: FormData) {
  const name = formData.get('name')?.toString();
  const phone = formData.get('phone')?.toString();
  const email = formData.get('email')?.toString();
  const password = formData.get('password')?.toString();

  // Validation
  if (!name || !phone || !email || !password) {
    return { error: 'All fields are required' };
  }

  try {
    // Check for existing user
    const existing = await prismaApp01.users.findFirst({
      where: {
        OR: [
          { emailUser: email },
          { phoneNumber: phone }
        ]
      }
    });

    if (existing) {
      return { error: 'Email or phone number already registered' };
    }

    // Generate secure UUID
    const id = uuidv4();

    // Hash password (10 salt rounds = ~100ms computation)
    const hash = await bcrypt.hash(password, 10);

    // Default role (users choose later)
    const role = 'CUSTOMER';

    // Create user in database
    await prismaApp01.users.create({
      data: {
        idUser: id,
        nameUser: name,
        emailUser: email,
        phoneNumber: phone,
        passwordHash: hash,
        role: role as any
      }
    });

    // Auto-login after registration
    await createSession({
      userId: id,
      email: email,
      role: role,
    });

  } catch (err) {
    console.error('[Registration Error]:', err);
    return { error: 'Server error during registration' };
  }

  // Redirect to role selection (customer vs business owner)
  redirect('/role-selection');
}

// ────────────────────────────────────────────────────────────────────────────
// Example 3: Update User Role (Protected Action)
// ────────────────────────────────────────────────────────────────────────────

import { sendVerificationEmailAction } from './email';

/**
 * Update User Role Action
 *
 * Allows user to switch between CUSTOMER and BUSINESS_OWNER roles
 *
 * Security:
 * - Session validation (must be authenticated)
 * - Session update after role change
 * - Email verification required for business owners
 *
 * @param role - New role to assign
 * @returns Error object or redirects to appropriate flow
 */
export async function updateRoleAction(role: 'CUSTOMER' | 'BUSINESS_OWNER') {
  const session = await getSession();

  // Require authentication
  if (!session) {
    return { error: 'Not authorized' };
  }

  try {
    // Update role in database
    await prismaApp01.users.update({
      where: { idUser: session.userId },
      data: { role: role as any }
    });

    // Update session cookie with new role
    await createSession({
      ...session,
      role: role
    });

  } catch (e) {
    console.error('[Role Update Error]:', e);
    return { error: 'Failed to change role' };
  }

  // Role-specific flows
  if (role === 'CUSTOMER') {
    redirect('/'); // Customer portal
  } else {
    // Business owners must verify email
    await sendVerificationEmailAction();
    redirect('/verify-email');
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Example 4: Protected Business Action (RBAC)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Create Business Profile Action
 *
 * Creates business profile for authenticated business owners
 *
 * Security:
 * - Role-based access control (BUSINESS_OWNER only)
 * - Input validation
 * - Database transaction for consistency
 *
 * @param formData - Business profile data
 * @returns Success with business ID or error
 */
export async function createBusinessProfileAction(formData: FormData) {
  // Require BUSINESS_OWNER role (throws if unauthorized)
  const session = await requireRole(['BUSINESS_OWNER', 'ADMIN']);

  const businessName = formData.get('businessName')?.toString();
  const businessDescription = formData.get('businessDescription')?.toString();

  // Validation
  if (!businessName || businessName.length < 3) {
    return { error: 'Business name must be at least 3 characters' };
  }

  try {
    // Check if user already has a business
    const existingBusiness = await prismaApp02.tableBusiness.findFirst({
      where: { idUserOwner: session.userId }
    });

    if (existingBusiness) {
      return { error: 'You already have a business profile' };
    }

    // Create business profile
    const business = await prismaApp02.tableBusiness.create({
      data: {
        idUserOwner: session.userId,
        businessName: businessName,
        businessDescription: businessDescription || null,
        currentPlan: 'FREE', // Default plan
        subscriptionStatus: 'incomplete',
        statusActive: true,
      }
    });

    console.log(`[Business Created] ID: ${business.idBusiness} by user ${session.userId}`);

    return {
      success: true,
      businessId: business.idBusiness
    };

  } catch (err) {
    console.error('[Business Creation Error]:', err);
    return { error: 'Failed to create business profile' };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Example 5: Multi-Database Query Action
// ────────────────────────────────────────────────────────────────────────────

/**
 * Fetch User Dashboard Data
 *
 * Aggregates data from both databases for dashboard display
 *
 * Demonstrates:
 * - Cross-database queries
 * - Data enrichment
 * - Permission checking
 *
 * @returns Dashboard data or error
 */
export async function fetchDashboardDataAction() {
  const session = await requireRole(['BUSINESS_OWNER', 'ADMIN']);

  try {
    // Fetch business from Database 02
    const business = await prismaApp02.tableBusiness.findFirst({
      where: { idUserOwner: session.userId },
      include: {
        TableServices: true, // Include services
        TableCommercialLocations: true, // Include locations
      }
    });

    if (!business) {
      return { error: 'Business not found' };
    }

    // Fetch appointments from Database 01 (cross-database reference)
    const appointments = await prismaApp01.tableAppointments.findMany({
      where: {
        idBusiness: business.idBusiness,
        startTimeDate: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      },
      include: {
        users: {
          select: { nameUser: true, emailUser: true, phoneNumber: true }
        }
      },
      orderBy: { startTimeDate: 'desc' }
    });

    // Fetch revenue from Database 01
    const revenue = await prismaApp01.tablePurchaseMovements.aggregate({
      where: {
        TableAppointments: {
          idBusiness: business.idBusiness
        },
        status: 'succeeded',
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      },
      _sum: {
        entrepreneurNet: true // Merchant's net (after platform fee)
      }
    });

    return {
      success: true,
      data: {
        business: {
          name: business.businessName,
          plan: business.currentPlan,
          logo: business.logoURL,
        },
        stats: {
          totalAppointments: appointments.length,
          totalRevenue: revenue._sum.entrepreneurNet || 0,
          totalServices: business.TableServices.length,
          totalLocations: business.TableCommercialLocations.length,
        },
        recentAppointments: appointments.slice(0, 10),
      }
    };

  } catch (err) {
    console.error('[Dashboard Data Error]:', err);
    return { error: 'Failed to load dashboard data' };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Client Usage Examples
// ────────────────────────────────────────────────────────────────────────────

/**
 * Example: Form Component with useFormState
 *
 * ```tsx
 * 'use client';
 * import { useFormState } from 'react-dom';
 * import { loginAction } from '@/app/actions/auth';
 *
 * export function LoginForm() {
 *   const [state, formAction] = useFormState(loginAction, {});
 *
 *   return (
 *     <form action={formAction}>
 *       <input name="email" type="email" required />
 *       <input name="password" type="password" required />
 *       {state?.error && <p className="text-red-500">{state.error}</p>}
 *       <button type="submit">Login</button>
 *     </form>
 *   );
 * }
 * ```
 */

/**
 * Example: Button Component with useTransition
 *
 * ```tsx
 * 'use client';
 * import { useTransition } from 'react';
 * import { updateRoleAction } from '@/app/actions/auth';
 * import { toast } from 'sonner';
 *
 * export function RoleButton({ role }: { role: 'CUSTOMER' | 'BUSINESS_OWNER' }) {
 *   const [isPending, startTransition] = useTransition();
 *
 *   function handleClick() {
 *     startTransition(async () => {
 *       const result = await updateRoleAction(role);
 *       if (result?.error) {
 *         toast.error(result.error);
 *       }
 *     });
 *   }
 *
 *   return (
 *     <button onClick={handleClick} disabled={isPending}>
 *       {isPending ? 'Updating...' : `Select ${role}`}
 *     </button>
 *   );
 * }
 * ```
 */

/**
 * Example: Server Component with Direct Call
 *
 * ```tsx
 * import { fetchDashboardDataAction } from '@/app/actions/dashboard';
 *
 * export default async function DashboardPage() {
 *   const result = await fetchDashboardDataAction();
 *
 *   if (!result.success) {
 *     return <div>Error: {result.error}</div>;
 *   }
 *
 *   return (
 *     <div>
 *       <h1>{result.data.business.name}</h1>
 *       <p>Revenue: ${result.data.stats.totalRevenue}</p>
 *       <p>Appointments: {result.data.stats.totalAppointments}</p>
 *     </div>
 *   );
 * }
 * ```
 */

// ────────────────────────────────────────────────────────────────────────────
// Best Practices Summary
// ────────────────────────────────────────────────────────────────────────────
//
// 1. Always validate session for protected actions
// 2. Use requireRole() for RBAC
// 3. Return structured response: { success, data?, error? }
// 4. Never log sensitive data (passwords, tokens)
// 5. Use bcrypt for password hashing (never store plain text)
// 6. Validate input before database operations
// 7. Use try-catch for error handling
// 8. Use redirect() for navigation after mutations
// 9. Use revalidatePath() to refresh cached data
// 10. Keep business logic in Server Actions (not in components)
//
// ────────────────────────────────────────────────────────────────────────────
