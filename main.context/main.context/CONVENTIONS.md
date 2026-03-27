# Convenciones de Código — Kuali Leal

## Estructura de archivos

```
src/
├── app/
│   ├── (route-group)/        # Agrupación lógica sin afectar URL
│   │   └── ruta/page.tsx     # Página
│   ├── actions/              # Server Actions
│   │   └── modulo.ts
│   └── api/                  # API Routes
│       └── endpoint/route.ts
├── components/
│   ├── ui/                   # Primitivos shadcn/ui (NO modificar manualmente)
│   ├── dashboard/            # Componentes del dashboard (solo app.kualileal.com)
│   └── ComponentName.tsx     # Componentes de página
├── hooks/
│   └── use-nombre.ts
├── lib/                      # Utilidades de servidor
│   ├── auth.ts
│   ├── prisma.ts
│   └── ...
└── scripts/                  # Migraciones y seeds
    └── migrate-*.ts
```

## Nombres

| Cosa | Convención | Ejemplo |
|---|---|---|
| Archivos TypeScript | kebab-case | `business-registration.ts` |
| Componentes React | PascalCase | `DashboardLayout.tsx` |
| Server Actions | camelCase + sufijo Action | `saveBusinessInfoAction` |
| Hooks | camelCase con prefijo use | `useMobile` |
| Tablas Prisma | PascalCase con prefijo Table | `TableBusiness` |
| Variables de entorno | SCREAMING_SNAKE_CASE | `STRIPE_SECRET_KEY` |
| API Routes | kebab-case en URL | `/api/dashboard/stats` |
| Route groups | kebab-case en paréntesis | `(auth)`, `(01-core)` |

## Server Actions

```typescript
'use server';

import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prismaApp02 } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

// 1. Schema de validación
const schema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().optional(),
});

// 2. Action con tipado explícito del retorno
export async function saveBusinessInfoAction(formData: FormData) {
  // 3. Siempre verificar sesión primero
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  // 4. Validar input
  const parsed = schema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
  });

  if (!parsed.success) {
    return { success: false, error: 'Datos inválidos' };
  }

  // 5. Try/catch para operaciones de BD
  try {
    await prismaApp02.tableBusiness.update({
      where: { id: session.businessId },
      data: parsed.data,
    });

    // 6. Revalidar o redirigir
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Error saving business info:', error);
    return { success: false, error: 'Error al guardar' };
  }
}
```

**Reglas:**
- Siempre empezar con `'use server'`
- Validar TODOS los inputs con Zod
- Verificar sesión antes de cualquier operación
- Envolver BD en try/catch
- NUNCA exponer errores de Prisma/Stripe al usuario
- Retornar `{ success: boolean, error?: string, data?: T }`
- Usar `redirect()` para navegación, `revalidatePath()` para refresh

## Componentes React

```typescript
// Server Component (por defecto)
import { getSession } from '@/lib/auth';
import { prismaApp02 } from '@/lib/prisma';

export default async function DashboardPage() {
  const session = await getSession();
  const business = await prismaApp02.tableBusiness.findFirst({
    where: { userId: session?.userId },
    select: { id: true, name: true, currentPlan: true },
  });

  return <DashboardLayout businessData={business} />;
}
```

```typescript
// Client Component (solo cuando se necesita interactividad)
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { saveBusinessInfoAction } from '@/app/actions/business';

interface BusinessFormProps {
  businessId: string;
  initialName: string;
}

export function BusinessForm({ businessId, initialName }: BusinessFormProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    const result = await saveBusinessInfoAction(formData);
    setLoading(false);

    if (result.success) {
      toast({ title: 'Guardado exitosamente' });
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  }

  return (
    <form action={handleSubmit}>
      {/* ... */}
    </form>
  );
}
```

**Reglas:**
- Server Components por defecto
- `'use client'` solo para interactividad (useState, onClick, etc.)
- Props tipadas con `interface`, no `type`
- Formularios con React Hook Form + Zod resolver (para forms complejos)
- Notificaciones con `useToast` de shadcn
- NUNCA hacer fetch a APIs propias desde Server Components; usar Prisma directo

## API Routes

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prismaApp02 } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  // 1. Verificar sesión
  const session = await getSession();
  if (!session || !session.businessId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  // 2. Siempre filtrar por businessId de la sesión
  const data = await prismaApp02.tableAppointments.findMany({
    where: { businessId: session.businessId },
    orderBy: { date: 'desc' },
  });

  return NextResponse.json(data);
}
```

**Reglas:**
- Verificar sesión en TODA API route (excepto webhooks que validan HMAC)
- SIEMPRE filtrar por `businessId` de la sesión (prevenir IDOR)
- Retornar status codes apropiados (401, 403, 404, 500)
- Webhooks: validar firma HMAC antes de procesar

## Manejo de errores

```typescript
// Server-side
try {
  // operación
} catch (error) {
  console.error('[saveBusinessInfo]', error);  // Log con contexto
  return { success: false, error: 'Error al guardar información' }; // Mensaje genérico al usuario
}

// Client-side
if (!result.success) {
  toast({
    title: 'Error',
    description: result.error || 'Algo salió mal',
    variant: 'destructive',
  });
}
```

**Reglas:**
- Server: `console.error` con contexto + retornar mensaje genérico
- NUNCA retornar `error.message` de Prisma/Stripe al cliente
- Client: toast para errores de usuario, console.error para debug

## Imports

```typescript
// ✅ Correcto — usar alias @/
import { prismaApp01, prismaApp02 } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { Button } from '@/components/ui/button';

// ❌ Incorrecto — imports relativos largos
import { prismaApp01 } from '../../../lib/prisma';

// ❌ Incorrecto — importar de NextAuth para sesiones
import { getServerSession } from 'next-auth';
```

## CSS y Estilos

- Tailwind CSS para todo el styling
- `cn()` de `@/lib/utils` para combinar clases condicionalmente
- NO usar CSS modules ni styled-components
- NO usar modo oscuro (fue removido del proyecto)
- Variables CSS definidas en `globals.css` para colores del brand
