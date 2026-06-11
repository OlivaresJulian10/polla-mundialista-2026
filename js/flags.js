// Banderas (emoji) por país, según los nombres usados en seed.sql
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

export const flag = (team) => FLAGS[team] || "🏳️";
