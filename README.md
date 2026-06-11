# ⚽ Polla Mundialista 2026

Aplicación web donde cada usuario crea su cuenta y pronostica el marcador de
**todos los partidos del Mundial 2026**. Los puntos se calculan automáticamente
contra los resultados reales y hay una **tabla de posiciones compartida**.

- **Marcador exacto** → 5 puntos
- **Acertar el resultado** (ganador o empate) sin el marcador exacto → 3 puntos
- **Fallar** → 0 puntos
- Un pronóstico se **bloquea** cuando empieza el partido.

Tecnología: HTML/CSS/JavaScript (sin compilar) + [Supabase](https://supabase.com)
(login + base de datos en la nube, plan gratuito).

---

## 📁 Estructura

```
Polla_Mundialista/
├─ index.html          ← página principal
├─ css/styles.css
├─ js/
│  ├─ config.js        ← AQUÍ pegas tus claves de Supabase
│  └─ app.js           ← lógica de la app
└─ sql/
   ├─ schema.sql       ← crea las tablas y la seguridad
   └─ seed.sql         ← carga los 12 grupos y los partidos
```

---

## 🚀 Puesta en marcha (15 minutos)

### 1. Crear el proyecto en Supabase
1. Entra a <https://supabase.com> → **Sign up** (gratis).
2. **New project** → ponle un nombre y una contraseña de base de datos (guárdala).
3. Espera 1–2 min a que termine de crearse.

### 2. Crear las tablas
1. En el menú lateral: **SQL Editor** → **New query**.
2. Copia TODO el contenido de [`sql/schema.sql`](sql/schema.sql), pégalo y pulsa **Run**.
3. Repite con [`sql/seed.sql`](sql/seed.sql) (esto carga los grupos y partidos).
   - Al final deberías ver 12 filas, cada grupo con **6 partidos**.

### 3. Conectar la app con Supabase
1. En Supabase: **Project Settings** (⚙️) → **API**.
2. Copia **Project URL** y la clave **anon / public**.
3. Abre [`js/config.js`](js/config.js) y pega ambos valores:
   ```js
   export const SUPABASE_URL = "https://xxxxx.supabase.co";
   export const SUPABASE_ANON_KEY = "eyJhbGci...";
   ```
   > La clave `anon` es pública a propósito; la base está protegida por las
   > reglas de seguridad (RLS) que creó `schema.sql`.

### 4. (Opcional) Quitar la confirmación por correo
Para que tus amigos entren al instante sin confirmar el correo:
**Authentication → Sign In / Providers → Email** → desactiva **Confirm email**.

### 5. Probar en tu computador
La app usa módulos JavaScript, así que **no se abre con doble clic** (file://).
Levanta un servidor local sencillo desde la carpeta del proyecto:

```powershell
# Opción A — si tienes Python:
python -m http.server 5500

# Opción B — si tienes Node:
npx serve .
```

Luego abre <http://localhost:5500> en el navegador.
*(En VS Code también sirve la extensión "Live Server".)*

---

## 👑 Hacerte administrador (para cargar resultados)

1. Regístrate en la app con tu correo (crea tu perfil).
2. En Supabase: **Table Editor → profiles** → busca tu fila →
   cambia **is_admin** a `true` → guarda.
3. Recarga la app: aparecerá la pestaña **Admin** para escribir los marcadores
   reales de cada partido. El ranking se recalcula solo.

---

## 🌐 Publicar en internet (gratis)

Como es un sitio estático, puedes subirlo a:

- **Netlify**: arrastra la carpeta a <https://app.netlify.com/drop>.
- **Vercel**: `npm i -g vercel` → `vercel` en la carpeta.
- **GitHub Pages**: sube los archivos a un repo y actívalo en Settings → Pages.

> Recuerda que `js/config.js` debe tener tus claves antes de subir.

---

## 📝 Notas

- **Equipos:** los grupos provienen del Sorteo Final (5 dic 2025). Verifícalos y,
  si hace falta, corrige cualquier equipo/fecha desde **Table Editor → matches**.
- **Fechas:** las horas de `seed.sql` son tentativas (solo para que funcione el
  bloqueo). Ajústalas con las reales en **Table Editor → matches** (columna `kickoff`).
- **Eliminatorias (octavos, cuartos, etc.):** aún no se cargan porque dependen de
  cómo terminen los grupos. Cuando se definan, agrégalas en **matches** con
  `stage` = `r32`, `r16`, `qf`, `sf`, `third` o `final`. Aparecerán solas en la app.
```
