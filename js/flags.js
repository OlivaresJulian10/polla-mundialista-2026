// Banderas (emoji) + código ISO para el escudo de cada país.
// Nombres según seed.sql.
export const FLAGS = {
  "México": "🇲🇽", "Sudáfrica": "🇿🇦", "Corea del Sur": "🇰🇷", "Chequia": "🇨🇿",
  "Canadá": "🇨🇦", "Suiza": "🇨🇭", "Bosnia y Herzegovina": "🇧🇦", "Catar": "🇶🇦",
  "Brasil": "🇧🇷", "Escocia": "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "Marruecos": "🇲🇦", "Haití": "🇭🇹",
  "Estados Unidos": "🇺🇸", "Turquía": "🇹🇷", "Paraguay": "🇵🇾", "Australia": "🇦🇺",
  "Alemania": "🇩🇪", "Costa de Marfil": "🇨🇮", "Ecuador": "🇪🇨", "Curazao": "🇨🇼",
  "Países Bajos": "🇳🇱", "Suecia": "🇸🇪", "Japón": "🇯🇵", "Túnez": "🇹🇳",
  "Bélgica": "🇧🇪", "Irán": "🇮🇷", "Egipto": "🇪🇬", "Nueva Zelanda": "🇳🇿",
  "España": "🇪🇸", "Arabia Saudita": "🇸🇦", "Uruguay": "🇺🇾", "Cabo Verde": "🇨🇻",
  "Francia": "🇫🇷", "Irak": "🇮🇶", "Noruega": "🇳🇴", "Senegal": "🇸🇳",
  "Argentina": "🇦🇷", "Austria": "🇦🇹", "Jordania": "🇯🇴", "Argelia": "🇩🇿",
  "Portugal": "🇵🇹", "Colombia": "🇨🇴", "Uzbekistán": "🇺🇿", "RD Congo": "🇨🇩",
  "Inglaterra": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Croacia": "🇭🇷", "Ghana": "🇬🇭", "Panamá": "🇵🇦",
};

// Código para el escudo circular (circle-flags). gb-eng / gb-sct para
// Inglaterra y Escocia.
export const ISO = {
  "México": "mx", "Sudáfrica": "za", "Corea del Sur": "kr", "Chequia": "cz",
  "Canadá": "ca", "Suiza": "ch", "Bosnia y Herzegovina": "ba", "Catar": "qa",
  "Brasil": "br", "Escocia": "gb-sct", "Marruecos": "ma", "Haití": "ht",
  "Estados Unidos": "us", "Turquía": "tr", "Paraguay": "py", "Australia": "au",
  "Alemania": "de", "Costa de Marfil": "ci", "Ecuador": "ec", "Curazao": "cw",
  "Países Bajos": "nl", "Suecia": "se", "Japón": "jp", "Túnez": "tn",
  "Bélgica": "be", "Irán": "ir", "Egipto": "eg", "Nueva Zelanda": "nz",
  "España": "es", "Arabia Saudita": "sa", "Uruguay": "uy", "Cabo Verde": "cv",
  "Francia": "fr", "Irak": "iq", "Noruega": "no", "Senegal": "sn",
  "Argentina": "ar", "Austria": "at", "Jordania": "jo", "Argelia": "dz",
  "Portugal": "pt", "Colombia": "co", "Uzbekistán": "uz", "RD Congo": "cd",
  "Inglaterra": "gb-eng", "Croacia": "hr", "Ghana": "gh", "Panamá": "pa",
};

export const flag = (team) => FLAGS[team] || "🏳️";

// URL del escudo circular (gratis, hatscripts/circle-flags).
export const crestUrl = (team) =>
  `https://hatscripts.github.io/circle-flags/flags/${ISO[team] || "xx"}.svg`;
