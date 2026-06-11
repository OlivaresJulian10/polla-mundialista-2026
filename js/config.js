// =====================================================================
//  CONFIGURACIÓN — Pega aquí tus claves de Supabase.
//  Las encuentras en:  Supabase -> Project Settings -> API
//    - Project URL            -> SUPABASE_URL
//    - Project API keys: anon  -> SUPABASE_ANON_KEY
//  (La clave "anon" es pública: es SEGURO ponerla en el navegador,
//   la base está protegida por Row Level Security.)
// =====================================================================

export const SUPABASE_URL = "https://ucaalcrdujucpdnmxjsd.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_RT-DMrXbbFDDXnNCXBtZwQ_-5AthA5k";

// Reglas de puntaje (solo informativo en la interfaz; el cálculo real
// está en la función get_leaderboard de la base de datos).
export const PUNTOS = {
  exacto: 5,    // marcador exacto
  resultado: 3, // acertar ganador/empate sin el marcador exacto
  fallo: 0,
};
