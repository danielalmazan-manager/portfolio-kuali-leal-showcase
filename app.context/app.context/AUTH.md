# Sistema de Autenticación — Kuali Leal

## Resumen ejecutivo
- Auth principal: JWT propio firmado con `jose`, cookie `kuali_session` en `.kualileal.com`
- Google OAuth: NextAuth v5 como wrapper, pero la sesión final es siempre el JWT propio
- NUNCA usar `getServerSession()` de NextAuth

## Cookie `kuali_session`
```
nombre:    kuali_session
dominio:   .kualileal.com  (compartida entre kualileal.com y app.kualileal.com)
httpOnly:  true
secure:    true (producción)
sameSite:  lax
path:      /
maxAge:    7 días
```

## JWT Payload
```typescript
{
  userId: string;      // ID de Users en App01
  email: string;
  role: 'CUSTOMER' | 'BUSINESS_OWNER' | 'ADMIN' | 'STAFF';
  businessId?: string; // ID de TableBusiness en App02 (solo roles operativos)
  iat: number;
  exp: number;
}
```

## Funciones de src/lib/auth.ts (ambos repos)

| Función | Uso | Dónde se llama |
|---|---|---|
| `createSession(payload)` | Firma JWT y setea cookie | Server actions de login/register |
| `getSession()` | Lee cookie, verifica JWT, retorna payload | Server Components, Server Actions |
| `getSessionData(request)` | Lee JWT del Request header (para middleware) | Solo en middleware.ts de app.kualileal.com |
| `updateSession(updates)` | Actualiza campos del JWT (ej: agregar businessId) | Después de crear negocio en onboarding |
| `refreshSession()` | Renueva el JWT si está próximo a expirar | Automático en getSession |
| `requireRole(roles[])` | Verifica que el usuario tenga uno de los roles | Proteger server actions |
| `logout()` | Elimina la cookie | logoutAction |

## Flujo 1: Login con Email + Password

```
1. Usuario → POST kualileal.com/login
2. loginAction (src/app/actions/auth.ts):
   a. Valida email + password con Zod
   b. prismaApp01.users.findUnique({ where: { email } })
   c. bcrypt.compare(password, user.passwordHash)
   d. createSession({ userId: user.id, email, role: user.role, businessId? })
   e. Cookie kuali_session seteada en .kualileal.com
   f. Redirect según rol:
      - CUSTOMER → /
      - BUSINESS_OWNER con negocio → app.kualileal.com/dashboard
      - BUSINESS_OWNER sin negocio → /role-selection
```

## Flujo 2: Registro

```
1. Usuario → POST kualileal.com/register
2. registerAction:
   a. Valida email, password, phone con Zod
   b. bcrypt.hash(password)
   c. prismaApp01.users.create({ email, passwordHash, phone, role: 'CUSTOMER' })
   d. createSession({ userId, email, role: 'CUSTOMER' })
   e. Redirect → /role-selection
```

## Flujo 3: Google OAuth

```
1. Click "Iniciar con Google" en /login
2. → /api/auth/[...nextauth] (NextAuth v5)
3. → Google consent screen
4. ← Google callback a /api/auth/[...nextauth]
5. signIn callback en nextauth.ts:
   a. prismaApp01.users.findUnique({ where: { email: googleEmail } })
   b. Si no existe → prismaApp01.users.create({ email, role: 'CUSTOMER', ... })
   c. createSession({ userId, email, role })
6. → /api/auth/sync
   a. Lee la cookie JWT recién creada
   b. Determina redirect final según rol
7. → GoogleAuthRedirect.tsx (componente cliente)
   a. Detecta parámetros de URL post-OAuth
   b. Ejecuta redirect final al destino correcto
```

### ¿Por qué es tan complicado el flujo de Google?
NextAuth maneja su propio flujo de callbacks y redirecciones. Como nosotros NO usamos las sesiones de NextAuth (usamos JWT propio), necesitamos:
1. Un endpoint `/api/auth/sync` para leer nuestra cookie y decidir el redirect
2. Un componente `GoogleAuthRedirect.tsx` del lado del cliente para manejar el redirect final (porque NextAuth puede dejar query params o estados intermedios)

## Flujo 4: Selección de rol post-registro

```
1. /role-selection (después de registrarse)
2. Usuario elige: "Soy Cliente" o "Tengo un Negocio"
3. updateRoleAction:
   a. getSession() → userId
   b. prismaApp01.users.update({ where: { id: userId }, data: { role } })
   c. updateSession({ role })
   d. Si CUSTOMER → redirect /
   e. Si BUSINESS_OWNER → redirect app.kualileal.com/register/business/whatsapp
```

## Middleware de app.kualileal.com

El middleware intercepta TODA request y aplica control de acceso:

```typescript
// Simplificado:
const session = await getSessionData(request);

if (!session) {
  // Sin sesión → redirige a kualileal.com/login (excepto rutas públicas)
}
if (session.role === 'CUSTOMER') {
  // Clientes pueden acceder a /register/business/* (están en proceso de convertirse en BUSINESS_OWNER)
  // Todo lo demás → redirige a kualileal.com
}
if (['BUSINESS_OWNER', 'ADMIN', 'STAFF'].includes(session.role)) {
  // Acceso al dashboard ✅
  // Si visita / → redirige a /dashboard
  // Si visita /login o /register → redirige a /dashboard
}
```

### Caso especial: CUSTOMER en app.kualileal.com
Un usuario con rol CUSTOMER puede acceder a `/register/business/*` porque está EN MEDIO del onboarding. Su rol es CUSTOMER hasta que completa el registro del negocio, momento en que se actualiza a BUSINESS_OWNER.

## Logout

```
1. LogoutButton → logoutAction o POST /api/auth/logout
2. Elimina cookie kuali_session (domain: .kualileal.com)
3. Redirect → kualileal.com/login
```

## Vulnerabilidades conocidas
1. Si el JWT_SECRET difiere entre repos, las sesiones no se comparten
2. No hay revocación de tokens (si roban un JWT, es válido hasta que expire)
3. No hay lista negra de sessions post-logout (la cookie se borra del browser, pero el JWT sigue siendo válido técnicamente)
4. El refresh de sesión no tiene protección contra replay attacks
