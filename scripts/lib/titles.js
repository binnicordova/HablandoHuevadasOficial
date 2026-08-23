/**
 * Title parsing for the Hablando Huevadas catalog.
 *
 * The channel has changed its naming convention at least six times in five
 * years, so the raw `title` is unusable as a UI string: it repeats the brand on
 * every row, buries the actual episode inside brackets and shouts in caps.
 *
 * This module derives readable fields from that mess. It never rewrites the
 * original `title` — everything here lands in new fields.
 *
 * Shapes it has to survive (all real, from the dataset):
 *   HABLANDO HUEVADAS - Duodécima Temporada [LA HISTORIA DE JORGE Y EL GUARDIA]
 *   Bonus Track HABLANDO HUEVADAS - Undécima Temporada [JORGITO Y JORGITA]
 *   Quinta Temporada (EL PAPÁ DE RICHAVO ESTÁ EN DROGAS)
 *   La Boa inmortal-"Cumpliendo sueños"]-Décimo Quinto Episodio
 *   Jorge escupe la gaseosa - Segunda Temporada
 *   Baños en Japón - Hablando Huevadas CORONATOUR
 *   El niño anticuchero 😂 #hablandohuevadas #jorgeluna
 */

const stripAccents = (value) =>
    String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

/** Lowercase, unaccented, single-spaced. Used for every match in here. */
const key = (value) =>
    stripAccents(String(value ?? ""))
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

const SEASON_ORDINALS = {
    primera: 1,
    "1era": 1,
    "1ra": 1,
    segunda: 2,
    "2da": 2,
    "2ra": 2,
    tercera: 3,
    "3ra": 3,
    "3era": 3,
    cuarta: 4,
    "4ta": 4,
    quinta: 5,
    "5ta": 5,
    sexta: 6,
    "6ta": 6,
    septima: 7,
    "7ma": 7,
    octava: 8,
    "8va": 8,
    novena: 9,
    "9na": 9,
    decima: 10,
    "10ma": 10,
    undecima: 11,
    "decima primera": 11,
    "11va": 11,
    duodecima: 12,
    "decima segunda": 12,
    "12va": 12,
    "decimo tercera": 13,
    "decima tercera": 13,
    "13va": 13,
    "decimo cuarta": 14,
    "decima cuarta": 14,
    "14va": 14,
};

/** Canonical Spanish label per season number, for the UI. */
const SEASON_LABELS = [
    null,
    "Primera Temporada",
    "Segunda Temporada",
    "Tercera Temporada",
    "Cuarta Temporada",
    "Quinta Temporada",
    "Sexta Temporada",
    "Séptima Temporada",
    "Octava Temporada",
    "Novena Temporada",
    "Décima Temporada",
    "Undécima Temporada",
    "Duodécima Temporada",
    "Decimotercera Temporada",
    "Decimocuarta Temporada",
];

const EPISODE_ORDINALS = {
    primer: 1,
    primero: 1,
    segundo: 2,
    tercer: 3,
    tercero: 3,
    cuarto: 4,
    quinto: 5,
    sexto: 6,
    septimo: 7,
    octavo: 8,
    noveno: 9,
    decimo: 10,
    undecimo: 11,
    "decimo primer": 11,
    "decimo primero": 11,
    duodecimo: 12,
    "decimo segundo": 12,
    "decimo tercer": 13,
    "decimo tercero": 13,
    "decimo cuarto": 14,
    "decimo quinto": 15,
    "decimo sexto": 16,
    "decimo septimo": 17,
    "decimo octavo": 18,
    "decimo noveno": 19,
    vigesimo: 20,
    "vigesimo primer": 21,
    "vigesimo primero": 21,
    "vigesimo segundo": 22,
    "vigesimo tercer": 23,
    "vigesimo tercero": 23,
    "vigesimo cuarto": 24,
};

/**
 * Non-numbered "seasons": the specials the channel keeps shipping between runs.
 * Order matters — the first hit wins, so the specific patterns come first.
 */
const SPECIAL_SEASONS = [
    {test: /\bbonus ?track\b/, label: "Bonus Track", short: "BONUS"},
    {test: /\bpre ?-? ?temporada\b/, label: "Pre Temporada", short: "PRE"},
    {test: /\bcoronatour\b/, label: "CoronaTour", short: "TOUR"},
    {
        test: /\b(tour ?provincia|tour mundial|madison square garden)\b/,
        label: "Tour",
        short: "TOUR",
    },
    {
        test: /\btrailer\b|\btrailer\b|\btráiler\b/,
        label: "Tráiler",
        short: "TRAILER",
    },
    {
        test: /\bdibujando huevadas\b/,
        label: "Dibujando Huevadas",
        short: "DIBUJO",
    },
    {test: /\b(hh )?la serie\b/, label: "HH La Serie", short: "SERIE"},
    {
        test: /\blas mejores huevadas\b/,
        label: "Las Mejores Huevadas",
        short: "BEST",
    },
    {
        test: /\bcontenido exclusivo\b|\bpremium\b/,
        label: "Contenido Exclusivo",
        short: "EXTRA",
    },
];

const SERIES = [
    {test: /\bdibujando huevadas\b/, name: "Dibujando Huevadas"},
    {test: /\b(hh )?la serie\b/, name: "HH La Serie"},
    {test: /\bcoronatour\b/, name: "CoronaTour"},
];
const DEFAULT_SERIES = "Hablando Huevadas";

/** Brand noise that never belongs in a clean title. */
const BRAND_PATTERNS = [
    /hablando\s+huevadas\s*2\.0/gi,
    /hablando\s*huevadas\s*2\.0/gi,
    /hablando\s+huevadas/gi,
    /hablandohuevadas/gi,
    /dibujando\s+huevadas/gi,
    /coronatour/gi,
    /\bhh\b/gi,
];

const SEASON_PHRASE =
    /(?:especial\s+)?(?:pre\s*-?\s*)?temporada\s*\d*|(?:\w+\s+)?temporada(?:\s*-)?|\d+\s*(?:era|da|ra|ta|va|ma|na|to)?\s*temp\.?\b|\btemp\.?\s*\d+/gi;
const EPISODE_PHRASE =
    /\b[\wáéíóúñ]+(?:\s+[\wáéíóúñ]+)?\s+(?:episodio|programa|capitulo|capítulo)\b/gi;

/** Proper nouns that must survive the sentence-casing pass. */
const PROPER_NOUNS = [
    "Jorge Luna",
    "Ricardo Mendoza",
    "Estados Unidos",
    "San Marcos",
    "Nueva York",
    "Madison Square Garden",
    "Machu Picchu",
    "Chapa Tu Money",
    "Hablando Huevadas",
    "Jorge",
    "Jorgito",
    "Jorgita",
    "Ricardo",
    "Richavo",
    "Mendoza",
    "Luna",
    "Monique",
    "Camila",
    "Alicia",
    "Mateo",
    "Alexa",
    "Siri",
    "Ciro",
    "Joseph",
    "Yukia",
    "Chiquiwillo",
    "Norka",
    "Carlos",
    "Perú",
    "Lima",
    "Callao",
    "Arequipa",
    "Huancayo",
    "Trujillo",
    "Piura",
    "Cusco",
    "Tacna",
    "Ilo",
    "Iquitos",
    "Ayacucho",
    "Chile",
    "Bolivia",
    "Colombia",
    "México",
    "España",
    "Madrid",
    "Barcelona",
    "Italia",
    "Japón",
    "Miami",
    "Dios",
    "Navidad",
    "Halloween",
    "WhatsApp",
    "YouTube",
    "TikTok",
    "Instagram",
    "Facebook",
    "Netflix",
    "Zoom",
    "Kardashian",
    "Moncler",
    "Peluchín",
    "Magaly",
    "Tongo",
];

/** Acronyms that stay shouted. */
const KEEP_UPPER = new Set([
    "HH",
    "DJ",
    "TV",
    "USA",
    "EEUU",
    "VIP",
    "PNP",
    "ATV",
    "ADN",
    "FBI",
    "OVNI",
    "ONP",
    "SBS",
    "NBA",
    "MTC",
    "SIDA",
    "IPTV",
    "CEO",
    "OMG",
    "XD",
]);

const PROPER_BY_KEY = new Map(PROPER_NOUNS.map((noun) => [key(noun), noun]));
const MULTIWORD_NOUNS = PROPER_NOUNS.filter((noun) => noun.includes(" "))
    .map((noun) => ({
        key: key(noun),
        value: noun,
        size: key(noun).split(" ").length,
    }))
    .sort((a, b) => b.size - a.size);

const LETTERS = /[a-záéíóúüñ]/i;

const isShouted = (value) => {
    const letters = value.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, "");
    if (letters.length < 4) return false;
    const upper = letters.replace(/[^A-ZÁÉÍÓÚÜÑ]/g, "").length;
    return upper / letters.length > 0.7;
};

const capitalizeFirst = (value) => {
    const index = value.search(LETTERS);
    if (index === -1) return value;
    return (
        value.slice(0, index) +
        value[index].toUpperCase() +
        value.slice(index + 1)
    );
};

/**
 * ALL CAPS -> readable sentence case, with the show's cast and places kept as
 * proper nouns. Titles that are already mixed case are left alone: whoever
 * typed them made a choice, and re-casing them only loses information.
 */
const toSentenceCase = (value) => {
    if (!isShouted(value)) return value;

    let out = value.toLowerCase();

    for (const noun of MULTIWORD_NOUNS) {
        out = out.replace(new RegExp(`\\b${noun.key}\\b`, "gi"), noun.value);
    }

    out = out
        .split(/(\s+)/)
        .map((token) => {
            if (!token.trim()) return token;
            const bare = token.replace(/^[^\wáéíóúñ]+|[^\wáéíóúñ]+$/gi, "");
            if (!bare) return token;
            const upper = stripAccents(bare).toUpperCase();
            if (KEEP_UPPER.has(upper)) return token.replace(bare, upper);
            const proper = PROPER_BY_KEY.get(key(bare));
            if (proper) return token.replace(bare, proper);
            return token;
        })
        .join("");

    return capitalizeFirst(out);
};

const tidy = (value) =>
    value
        .replace(/\s+/g, " ")
        .replace(/^[\s\-–—·:,."'¨“”[\]()#|]+/, "")
        .replace(/[\s\-–—·:,"“”'¨#|[\]]+$/, "")
        .replace(/^["“”'](.*)["“”']$/, "$1")
        .trim();

/** `#hablandohuevadas #jorgeluna` -> ["hablandohuevadas", "jorgeluna"] */
const extractHashtags = (title) =>
    (String(title ?? "").match(/#[\p{L}\p{N}_]+/gu) ?? []).map((tag) =>
        tag.slice(1).toLowerCase()
    );

const findSeason = (normalized) => {
    // A numbered season always wins over a special: "Bonus Track HABLANDO
    // HUEVADAS - Undécima Temporada" belongs in season 11, not in a limbo
    // bucket where the user can never find it again.
    const worded = normalized.match(/([a-z0-9]+(?:\s+[a-z]+)?)\s+temporada\b/);
    if (worded) {
        const candidate = worded[1].trim();
        const number =
            SEASON_ORDINALS[candidate] ??
            SEASON_ORDINALS[candidate.split(" ").pop()] ??
            null;
        if (number) {
            return {
                label: SEASON_LABELS[number] ?? `Temporada ${number}`,
                number,
                short: `T${number}`,
            };
        }
    }

    // "temporada 3", "2da temp", "2 temp", "hablando huevadas 2.0"
    const numeric =
        normalized.match(/temporada\s*(\d{1,2})\b/) ??
        normalized.match(
            /\b(\d{1,2})\s*(?:era|da|ra|ta|va|ma|na|to)?\s*temp\b/
        ) ??
        normalized.match(/huevadas\s*(2)\.0\b/);
    if (numeric) {
        const number = Number(numeric[1]);
        if (number >= 1 && number <= 20) {
            return {
                label: SEASON_LABELS[number] ?? `Temporada ${number}`,
                number,
                short: `T${number}`,
            };
        }
    }

    for (const special of SPECIAL_SEASONS) {
        if (special.test.test(normalized)) {
            return {label: special.label, number: null, short: special.short};
        }
    }

    return {label: null, number: null, short: null};
};

const findEpisodeNumber = (normalized) => {
    const match = normalized.match(
        /\b([a-z]+(?:\s+[a-z]+)?)\s+(?:episodio|programa|capitulo)\b/
    );
    if (!match) return null;
    const candidate = match[1].trim();
    return (
        EPISODE_ORDINALS[candidate] ??
        EPISODE_ORDINALS[candidate.split(" ").slice(-2).join(" ")] ??
        EPISODE_ORDINALS[candidate.split(" ").pop()] ??
        null
    );
};

const findSeries = (normalized) => {
    for (const entry of SERIES) {
        if (entry.test.test(normalized)) return entry.name;
    }
    return DEFAULT_SERIES;
};

/**
 * The episode name, in order of preference:
 *  1. text inside [brackets] — the convention since season 5
 *  2. text inside (parentheses) when it is long enough to be a title
 *  3. whatever is left after stripping brand, season and episode noise
 */
const findCleanTitle = (title, normalized) => {
    const bracketed = title.match(/\[([^\]]+)\]/);
    if (bracketed && tidy(bracketed[1]).length > 2) {
        return tidy(bracketed[1]);
    }

    const quoted = title.match(/["“]([^"”]{6,})["”]/);
    const parens = title.match(/\(([^)]{10,})\)/);
    if (parens && !/parte\s*\d/i.test(parens[1])) return tidy(parens[1]);
    if (quoted) return tidy(quoted[1]);

    // Hashtags go first: they are a copy of the brand and stripping the brand
    // before them would leave a bare "#" behind.
    let rest = title.replace(/#[\p{L}\p{N}_]+/gu, " ");
    for (const pattern of BRAND_PATTERNS) rest = rest.replace(pattern, " ");
    rest = rest.replace(SEASON_PHRASE, " ");
    rest = rest.replace(EPISODE_PHRASE, " ");
    rest = rest.replace(/\bft\.?\b/gi, "ft.");
    rest = tidy(rest);

    if (rest.length > 2) return rest;

    // Nothing survived: the whole title was brand + season, e.g. "Hablando
    // Huevadas 2.0". Fall back to the season label so the row still reads.
    const season = findSeason(normalized);
    return season.label ?? tidy(title);
};

/**
 * Parses one YouTube title into the fields the app renders.
 * Pure and side-effect free, so it can run over the whole dataset offline.
 */
const parseTitle = (rawTitle) => {
    const title = String(rawTitle ?? "")
        .replace(/\s+/g, " ")
        .trim();
    const normalized = key(title);

    const season = findSeason(normalized);
    const cleanRaw = findCleanTitle(title, normalized);
    const episodeNumber = findEpisodeNumber(normalized);

    // The 2019 run was numbered by episode ("Vigésimo Tercer Episodio") and
    // never said "temporada". It is season one, and filing it as such is what
    // lets the app show a complete season list instead of a limbo bucket.
    const inferredFirstSeason = !season.label && episodeNumber !== null;

    return {
        title_clean: toSentenceCase(cleanRaw) || title,
        season: inferredFirstSeason ? SEASON_LABELS[1] : season.label,
        season_number: inferredFirstSeason ? 1 : season.number,
        season_short: inferredFirstSeason ? "T1" : season.short,
        series: findSeries(normalized),
        episode_number: episodeNumber,
        hashtags: extractHashtags(title),
    };
};

/** Likes per view, the only quality signal available without an API key. */
const likeRatio = (likeCount, viewCount) => {
    if (!likeCount || !viewCount) return null;
    return Number((likeCount / viewCount).toFixed(4));
};

module.exports = {
    DEFAULT_SERIES,
    parseTitle,
    likeRatio,
    toSentenceCase,
    extractHashtags,
    SEASON_LABELS,
};
