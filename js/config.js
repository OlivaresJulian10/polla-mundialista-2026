// =====================================================================
//  CONFIGURACIÓN — Pega aquí tus claves de Supabase.
//  Las encuentras en:  Supabase -> Project Settings -> API
//    - Project URL            -> SUPABASE_URL
//    - Project API keys: anon  -> SUPABASE_ANON_KEY
//  (La clave "anon" es pública: es SEGURO ponerla en el navegador,
//   la base está protegida por Row Level Security.)
// =====================================================================

export const SUPABASE_URL = "PEGA_AQUI_TU_PROJECT_URL";
export const SUPABASE_ANON_KEY = "PEGA_AQUI_TU_ANON_KEY";

// Reglas de puntaje (solo informativo en la interfaz; el cálculo real
// está en la función get_leaderboard de la base de datos).
export const PUNTOS = {
  exacto: 5,    // marcador exacto
  resultado: 3, // acertar ganador/empate sin el marcador exacto
  fallo: 0,
};
