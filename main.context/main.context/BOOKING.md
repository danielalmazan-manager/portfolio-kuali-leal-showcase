# Módulo de Booking Público — kualileal.com

## Ubicación
- **Ruta:** `kualileal.com/src/app/reserva/[slug]/`
- **Componente principal:** `BookingFlow.tsx` (Client Component)
- **Server Action:** `src/app/actions/appointments.ts`

## Flujo del Cliente
1. **Acceso:** El cliente entra vía `kualileal.com/reserva/nombre-del-negocio` (slug).
2. **Selección de Servicio:** Catálogo dinámico cargado desde `prismaApp02.tableServices`.
3. **Selección de Ubicación:** Si el negocio tiene varias sedes, el cliente elige una.
4. **Calendario:** Selección de fecha. La disponibilidad se consulta en tiempo real vía `/api/availability`.
5. **Horarios:** Lista de slots disponibles (ej: 09:00, 10:00).
6. **Detalles:** Formulario de contacto (Nombre, Email, WhatsApp).
7. **Confirmación:** Creación de cita en `TableAppointments` y redirección a página de éxito.

## Backend e Integración
- **Slugs:** Los negocios tienen un campo `slug` único en `TableBusiness`.
- **Usuarios Invitados:** Si el cliente no tiene cuenta, se crea automáticamente un registro en `users` con rol `CUSTOMER`.
- **Pre-registro:** El flujo permite reservar sin login previo, capturando datos en el último paso.

## Seguridad e Infraestructura
- **Rate Limiting:** Máximo 5 intentos de reserva por 15 minutos por IP.
- **Validación:** Se verifica la existencia del servicio y la ubicación en el servidor antes de confirmar.
- **Notificaciones:** Integrado con el sistema de WhatsApp para avisar al negocio (próximamente).
