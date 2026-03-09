# 🔧 PROMPT MAESTRO — Reconstrucción completa de Plusspaz

> Este documento contiene las instrucciones detalladas para recrear el proyecto **Plusspaz** desde cero con cualquier IA o desarrollador.

---

## 📋 DESCRIPCIÓN GENERAL

**Plusspaz** es una plataforma web de fotografía profesional para eventos. Los fotógrafos suben fotos de un evento (boda, maratón, cumpleaños, etc.) y los asistentes pueden encontrar sus fotos usando reconocimiento facial con IA. El sistema permite:

1. Los asistentes ingresan un código de evento en la página principal
2. Ven la galería del evento con marcas de agua
3. Se toman una selfie
4. La IA compara su rostro con todas las fotos del evento
5. Reciben 1 foto gratis y pueden comprar las demás ($2 c/u por defecto)
6. El pago se realiza por SINPE Móvil o transferencia bancaria (Costa Rica)
7. El fotógrafo aprueba/rechaza la solicitud desde el panel admin
8. Al aprobar, el cliente puede descargar las fotos sin marca de agua

---

## 🛠 STACK TECNOLÓGICO

- **Frontend:** React 18 + TypeScript + Vite
- **Estilos:** Tailwind CSS + shadcn/ui
- **Fuentes:** Space Grotesk (display/headings) + DM Sans (body)
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **IA:** Google Gemini 2.5 Flash (vía Lovable AI Gateway) para reconocimiento facial
- **Email:** Resend API para notificaciones al fotógrafo
- **Routing:** React Router DOM v6
- **Estado:** React Query + useState/useEffect
- **Notificaciones:** Sonner (toasts)

---

## 🎨 DISEÑO Y ESTÉTICA

### Tema: Dark luxury / fotografía profesional
- **Fondo oscuro:** `hsl(220, 20%, 7%)` — azul-negro profundo
- **Dorado primario:** `hsl(38, 92%, 55%)` — color principal para CTAs y acentos
- **Texto claro:** `hsl(40, 20%, 95%)` — crema suave, no blanco puro
- **Cards glassmorphism:** `bg-card/80 backdrop-blur-xl border border-border/50` con sombras profundas
- **Gradiente dorado:** `linear-gradient(135deg, hsl(38, 92%, 55%), hsl(28, 100%, 60%))`
- **Solo modo oscuro** (no hay light mode)

### Tokens CSS (index.css)
```css
:root {
  --background: 220 20% 7%;
  --foreground: 40 20% 95%;
  --card: 220 18% 10%;
  --primary: 38 92% 55%;
  --primary-foreground: 220 20% 7%;
  --secondary: 220 15% 15%;
  --muted-foreground: 220 10% 55%;
  --accent: 38 70% 45%;
  --destructive: 0 72% 51%;
  --border: 220 15% 18%;
  --gold: 38 92% 55%;
  --gold-glow: 38 100% 65%;
}
```

### Clases CSS personalizadas
- `.glass-card` — Cards con glassmorphism y sombra
- `.gold-gradient-text` — Texto con gradiente dorado
- `.gold-glow` — Box-shadow dorado animado
- `.watermark-overlay` / `.watermark-text` — Marca de agua sobre fotos
- `.photo-grid` — Grid responsivo de fotos (2→3→4 columnas)
- `.animate-fade-up` — Animación de entrada desde abajo
- `.animate-pulse-gold` — Pulsación dorada para estados de espera

### Tailwind config
- Fuentes: `font-display` (Space Grotesk), `font-body` (DM Sans)
- Color `gold` con variante `glow`
- Color `surface-elevated`
- Container centrado con padding `1.5rem`, max `1400px`

---

## 📐 ARQUITECTURA DE PÁGINAS

### 1. `/` — Landing Page (Index.tsx)
- Header fijo con logo (icono Camera + "Plusspaz" con "paz" en dorado) y link a `/admin`
- Hero section a pantalla completa con imagen de fondo, gradiente superpuesto
- Badge "Reconocimiento facial inteligente" con icono ScanFace
- Título: "Encuentra tus fotos **al instante**" (al instante en gradiente dorado)
- Input para código de evento (tracking-widest, centrado, uppercase automático)
- Sección "¿Cómo funciona?" con 3 tarjetas: Ingresa tu código → Tómate una selfie → Descarga tus fotos
- Footer simple con copyright

### 2. `/evento/:eventId` — Página del Evento (EventPage.tsx)
Tiene 3 vistas internas (estado `view`):
- **gallery**: Muestra todas las fotos del evento con marca de agua "PLUSSPAZ". Botón "Encontrar mis fotos"
- **selfie**: Pantalla de consentimiento + captura de cámara (cámara frontal). Guía ovalada sobre el video
- **results**: Fotos que coinciden con el rostro. Cada foto muestra:
  - Porcentaje de confianza (badge con punto de color: verde ≥85%, dorado ≥70%, gris <70%)
  - Badge "GRATIS" en la primera foto
  - Foto gratis: descarga directa sin marca de agua
  - Foto de pago: botón "$2.00 — Comprar" con icono Lock + marca de agua
  - Foto comprada y aprobada: botón "Descargar" verde
  - Estado "Esperando aprobación del fotógrafo..." con animación pulse-gold

#### Lógica de foto gratis:
- Se guarda en localStorage por evento (`plusspaz_free_${eventId}`)
- La primera foto del resultado es gratis
- Una vez descargada, se marca como usada

#### Polling de aprobación:
- Cada 5 segundos consulta el estado de `purchase_requests`
- Si cambia a "approved", habilita la descarga
- Si cambia a "rejected", muestra error

### 3. `/auth` — Autenticación (AuthPage.tsx)
- Login y registro con email/contraseña (Supabase Auth)
- Registro pide nombre adicional (se guarda en metadata)
- Link "¿Olvidaste tu contraseña?" que muestra formulario de recuperación
- Envía email de recuperación con redirect a `/reset-password`
- NO hay auto-confirm de email (los usuarios deben verificar)

### 4. `/reset-password` — Restablecer Contraseña (ResetPassword.tsx)
- Detecta token de recuperación en URL hash
- Escucha evento `PASSWORD_RECOVERY` de Supabase Auth
- Formulario de nueva contraseña + confirmación

### 5. `/admin` — Panel de Administración (AdminDashboard.tsx)
Requiere autenticación. Secciones:

**Mis eventos:**
- Lista de eventos con nombre, fecha, ubicación, conteo de fotos, código
- Botón copiar código
- Botones: subir fotos, editar, ver evento, eliminar
- Dialog para crear/editar evento: nombre, código (uppercase), fecha, precio/foto, ubicación
- Subida múltiple de fotos al Storage bucket `event-photos` con ruta `{eventId}/{uuid}.{ext}`

**Solicitudes de compra:**
- Lista de purchase_requests con estado (pending/approved/rejected)
- Iconos de estado: Clock (pending), CheckCircle (approved), XCircle (rejected)
- Muestra: nombre cliente, cantidad fotos, monto, método pago, teléfono
- Botón para ver comprobante de pago (signed URL temporal de 5 min)
- Botones aprobar (verde) / rechazar (rojo) para solicitudes pendientes

**Administradores:**
- Gestión de roles admin via Edge Function `manage-admins`
- Formulario para agregar admin por email
- Lista de admins con botón para remover (no puede removerse a sí mismo)

---

## 🗄 BASE DE DATOS (Supabase PostgreSQL)

### Enum
```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
```

### Tablas

#### `events`
| Columna | Tipo | Default |
|---------|------|---------|
| id | uuid | gen_random_uuid() |
| admin_id | uuid | NOT NULL |
| name | text | NOT NULL |
| code | text | NOT NULL (único) |
| date | date | NOT NULL |
| location | text | nullable |
| description | text | nullable |
| price_per_photo | numeric | 2.00 |
| free_photos | integer | 1 |
| currency | text | 'USD' |
| is_active | boolean | true |
| created_at | timestamptz | now() |
| updated_at | timestamptz | now() |

#### `event_photos`
| Columna | Tipo | Default |
|---------|------|---------|
| id | uuid | gen_random_uuid() |
| event_id | uuid | FK → events.id |
| storage_path | text | NOT NULL |
| original_filename | text | nullable |
| thumbnail_path | text | nullable |
| width | integer | nullable |
| height | integer | nullable |
| created_at | timestamptz | now() |

#### `purchase_requests`
| Columna | Tipo | Default |
|---------|------|---------|
| id | uuid | gen_random_uuid() |
| event_id | uuid | FK → events.id |
| photo_ids | uuid[] | NOT NULL |
| client_name | text | nullable |
| client_phone | text | nullable |
| total_amount | numeric | NOT NULL |
| currency | text | 'USD' |
| payment_method | text | 'sinpe' |
| payment_reference | text | nullable |
| payment_proof_path | text | nullable |
| status | text | 'pending' |
| approved_by | uuid | nullable |
| approved_at | timestamptz | nullable |
| created_at | timestamptz | now() |
| updated_at | timestamptz | now() |

#### `search_requests` (log de búsquedas)
| Columna | Tipo | Default |
|---------|------|---------|
| id | uuid | gen_random_uuid() |
| event_id | uuid | FK → events.id |
| selfie_path | text | nullable |
| matched_photo_ids | uuid[] | '{}' |
| client_name | text | nullable |
| client_phone | text | nullable |
| status | text | 'pending' |
| created_at | timestamptz | now() |

#### `profiles`
| Columna | Tipo | Default |
|---------|------|---------|
| id | uuid | gen_random_uuid() |
| user_id | uuid | NOT NULL |
| display_name | text | nullable |
| phone | text | nullable |
| created_at | timestamptz | now() |
| updated_at | timestamptz | now() |

#### `user_roles`
| Columna | Tipo | Default |
|---------|------|---------|
| id | uuid | gen_random_uuid() |
| user_id | uuid | NOT NULL |
| role | app_role | NOT NULL |
| UNIQUE(user_id, role) | | |

### Función de seguridad
```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

### Políticas RLS

**events:**
- SELECT público: `is_active = true`
- ALL autenticados dueños: `auth.uid() = admin_id`
- ALL autenticados admins: `has_role(auth.uid(), 'admin')`

**event_photos:**
- SELECT público: evento activo
- ALL autenticados: dueños del evento (`events.admin_id = auth.uid()`)

**purchase_requests:**
- INSERT público: `event_id IS NOT NULL AND array_length(photo_ids, 1) > 0`
- SELECT público: `true`
- UPDATE autenticados: dueños del evento
- No se puede DELETE

**search_requests:**
- INSERT público: `event_id IS NOT NULL`
- SELECT público: `true`
- ALL autenticados: dueños del evento

**profiles:**
- INSERT/UPDATE/SELECT: solo su propio `user_id`
- No se puede DELETE

**user_roles:**
- SELECT público: `auth.uid() = user_id`
- ALL autenticados: `has_role(auth.uid(), 'admin')`

---

## 📦 Storage Buckets

1. **`event-photos`** — Fotos de eventos (público para lectura)
   - Ruta: `{eventId}/{uuid}.{extension}`
2. **`payment-proofs`** — Comprobantes de pago (privado, signed URLs)
   - Ruta: `{uuid}.{extension}`

---

## ⚡ Edge Functions (Supabase/Deno)

### 1. `face-match` — Reconocimiento facial
- **Input:** `{ selfieBase64: string, eventId: string }`
- **Proceso:**
  1. Obtiene todas las fotos del evento con URLs públicas
  2. Procesa en lotes de 4 fotos
  3. Envía selfie + batch al modelo Gemini 2.5 Flash vía `https://ai.gateway.lovable.dev/v1/chat/completions`
  4. El prompt pide comparar rasgos faciales y devolver JSON con `photoId` y `score` (0.0-1.0)
  5. Solo incluye matches con score ≥ 0.5
  6. Consolida todos los batches y ordena por score descendente
- **Output:** `{ matches: [{ photoId: string, score: number }] }`
- **Manejo de errores:** 429 (rate limit), 402 (créditos agotados), errores de parseo continúan con siguiente batch
- **Secret requerido:** `LOVABLE_API_KEY`

### 2. `notify-purchase` — Notificación por email
- **Input:** `{ purchaseRequestId: string }`
- **Proceso:**
  1. Obtiene detalles de la compra, evento y email del admin
  2. Envía email HTML elegante vía Resend API
  3. Muestra: evento, cliente, teléfono, cantidad fotos, método pago, total
- **Secret requerido:** `RESEND_API_KEY`
- **From:** `Plusspaz <onboarding@resend.dev>` (cambiar al dominio propio después)

### 3. `manage-admins` — Gestión de administradores
- **Input:** `{ action: "list" | "add" | "remove", email?: string, user_id?: string }`
- **Acciones:**
  - `list`: Devuelve todos los admins con email
  - `add`: Busca usuario por email y agrega rol admin
  - `remove`: Elimina rol admin (no puede removerse a sí mismo)
- **Seguridad:** Verifica que el solicitante sea admin usando `has_role`
- **Usa service_role_key** para acceder a auth.admin

---

## 🧩 COMPONENTES CLAVE

### Header
- Fixed top, glassmorphism (`bg-background/80 backdrop-blur-xl`)
- Logo: icono Camera en cuadrado dorado + "Plusspaz" (paz en dorado)
- Link a /admin con icono Settings

### SelfieCapture
1. **Pantalla de consentimiento:** Icono Shield, explica que la imagen no se almacena, botón "Acepto, buscar mis fotos"
2. **Cámara:** Video con `facingMode: "user"`, guía ovalada con borde dorado pulsante
3. **Captura:** Preview de la foto + botones "Repetir" / "Buscar mis fotos"
4. Convierte a JPEG base64 calidad 0.8

### WatermarkImage
- Imagen con 3 overlays de texto "PLUSSPAZ" rotados -30° en posiciones diferentes (centro, arriba, abajo)
- Bloquea click derecho (`onContextMenu prevent`)
- Bloquea drag (`draggable={false}`)
- Hover zoom effect (`group-hover:scale-105`)
- Skeleton loading state

### PhotoResultCard
- Badge de confianza con punto de color
- Badge "GRATIS" dorado para foto gratuita
- 3 estados: gratis (descargar gratis), comprar ($X.XX), comprado (descargar verde)
- Fotos no compradas muestran WatermarkImage, compradas/gratis muestran img normal

### PaymentModal
- Selector SINPE Móvil / Transferencia bancaria
- SINPE: Número `89406622`, nombre Plusspaz, monto en colones (×530 tipo cambio)
- Transferencia: Info BCR (pendiente de configurar)
- Campos: nombre (requerido), teléfono (opcional), comprobante de pago (imagen, opcional)
- Botón "Ya pagué" envía la solicitud
- Conversión automática USD→Colones

---

## 🔐 FLUJO DE AUTENTICACIÓN

1. El fotógrafo va a `/auth` y se registra con email/contraseña
2. Verifica su email (NO auto-confirm)
3. Inicia sesión → redirige a `/admin`
4. El primer admin debe insertarse manualmente en `user_roles` vía SQL
5. Los admins existentes pueden agregar más admins desde el panel

---

## 📱 PWA (Progressive Web App)

El proyecto incluye:
- `manifest.json` con nombre "Plusspaz", iconos 192x192 y 512x512
- Service Worker básico (`sw.js`) para cache
- Theme color: `#111827`

---

## 🔄 FLUJO COMPLETO DEL USUARIO FINAL

1. Recibe código de evento del fotógrafo (ej: "BODA2026")
2. Entra a la web → ingresa código → ve galería con marcas de agua
3. Presiona "Encontrar mis fotos"
4. Acepta consentimiento de reconocimiento facial
5. Se toma selfie con cámara frontal
6. Espera procesamiento (la IA compara con todas las fotos en batches de 4)
7. Ve resultados ordenados por confianza
8. Descarga 1 foto gratis (sin marca de agua)
9. Para más fotos: presiona "Comprar" → modal de pago
10. Realiza SINPE Móvil al número indicado
11. Llena nombre, teléfono, sube comprobante opcional
12. Presiona "Ya pagué" → se crea purchase_request con status "pending"
13. El fotógrafo recibe email de notificación
14. El fotógrafo aprueba desde el panel admin
15. La página del cliente detecta aprobación (polling cada 5s)
16. El cliente descarga las fotos sin marca de agua

---

## 🔑 SECRETS/ENV REQUERIDOS

| Variable | Descripción |
|----------|-------------|
| `SUPABASE_URL` | URL del proyecto Supabase (automático) |
| `SUPABASE_ANON_KEY` | Clave pública (automático) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio (automático) |
| `LOVABLE_API_KEY` | Para IA Gemini via gateway |
| `RESEND_API_KEY` | Para enviar emails de notificación |

---

## 📂 ESTRUCTURA DE ARCHIVOS

```
src/
├── pages/
│   ├── Index.tsx          — Landing page
│   ├── EventPage.tsx      — Página de evento (galería/selfie/resultados)
│   ├── AdminDashboard.tsx — Panel admin
│   ├── AuthPage.tsx       — Login/registro
│   ├── ResetPassword.tsx  — Restablecer contraseña
│   └── NotFound.tsx       — 404
├── components/
│   ├── Header.tsx         — Header fijo
│   ├── SelfieCapture.tsx  — Captura de selfie
│   ├── PhotoResultCard.tsx — Tarjeta de resultado
│   ├── WatermarkImage.tsx — Imagen con marca de agua
│   ├── PaymentModal.tsx   — Modal de pago
│   └── ui/               — Componentes shadcn/ui
├── assets/               — Imágenes estáticas
├── index.css             — Tokens de diseño + clases custom
└── App.tsx               — Router principal
supabase/functions/
├── face-match/index.ts
├── notify-purchase/index.ts
└── manage-admins/index.ts
```

---

## ⚠️ NOTAS IMPORTANTES

1. **Todo el texto de la UI está en español** (Costa Rica)
2. **Moneda principal:** USD con conversión visual a colones costarricenses (×530)
3. **Número SINPE hardcodeado:** `89406622` en PaymentModal
4. **El reconocimiento facial NO almacena la selfie** — se procesa en memoria
5. **Las fotos no compradas siempre muestran marca de agua** triple con texto "PLUSSPAZ"
6. **No hay pasarela de pago integrada** — el flujo es manual (SINPE → aprobación admin)
7. **Los roles se manejan en tabla separada** `user_roles`, nunca en profiles
8. **RLS es crítico** — las políticas permiten acceso público de lectura a eventos activos y creación de solicitudes
9. **El primer admin se crea manualmente** vía SQL: `INSERT INTO user_roles (user_id, role) VALUES ('uuid-aquí', 'admin')`

---

*Documento generado el 9 de marzo de 2026. Versión completa del proyecto Plusspaz.*
