/**
 * Microcopy matrix — every user-facing string in the app.
 *
 * Voice: the show's voice. Peruvian, achorado, friendly-disrespectful. It
 * insults the user the way a pata does, never the way a stranger would.
 *
 * Rules that keep it from turning into noise:
 *  - The joke never eats the instruction. If a string tells someone what to
 *    do, the instruction survives being read straight.
 *  - Swearing stays in the censored spellings used here (csm, mrda, ptada,
 *    cjo). Uncensored stops are a store-review problem, not a taste problem.
 *  - Accessibility labels stay literal. A screen reader announcing a punchline
 *    every time you land on a heart button is not funny by the third time.
 */
export const COPY = {
    appName: "Hablando Huevadas",

    tabs: {
        home: "Inicio",
        shorts: "Shorts",
        soundboard: "Audios",
        search: "Buscar",
        me: "Mi zona",
    },

    home: {
        greeting: "Ya pues, causa",
        dailyBadge: "Huevada del día",
        dailyHint: "Cambia a la medianoche. No te hagas el vivo.",
        nowPlaying: "Sonando ahorita",
        continueTitle: "Seguías viendo esto",
        continueSubtitle: "Lo dejaste botado. Termínalo.",
        continueAction: "Ver todo",
        catalogTitle: "Todos los episodios",
        catalogSubtitle: "535 huevadas completas. Suerte.",
        shuffle: "Sorpréndeme, cjo",
        emptyContinue:
            "No has visto nada todavía. Dale play arriba, no seas tímido.",
    },

    shorts: {
        title: "Shorts",
        hint: "Desliza, cro. Como en el TikTok pero sin bailes.",
        muted: "Sin volumen, sube el sonido",
    },

    soundboard: {
        title: "Audios",
        subtitle: "Los audios que ya te sabes de memoria.",
        tapHint: "Tócalo y suena. Así de simple, cro.",
        stopAll: "Ya cállalo",
        locked: "Todavía no",
        lockedHint: "Este audio aún no está listo. Paciencia, csm.",
        empty: "Acá no hay ni un audio todavía. Vuelve luego.",
        playbackFailed: "Ese audio no quiso sonar. Inténtalo de nuevo.",
    },

    search: {
        placeholder: "Busca un episodio, un invitado, una ptada",
        recent: "Lo que buscaste antes",
        results: (n: number) => (n === 1 ? "1 resultado" : `${n} resultados`),
        emptyTitle: "Nada, cro. Cero.",
        emptyHint: "Escríbelo bien o busca a otro invitado. No adivinamos.",
        idleTitle: "Busca entre 3,600+ huevadas",
        idleHint: "Un nombre, un episodio, una frase que te acuerdes a medias.",
        filters: {all: "Todo", videos: "Episodios", shorts: "Shorts"},
        clear: "Borrar búsqueda",
    },

    me: {
        title: "Mi zona",
        streakTitle: "Tu racha",
        streakDays: (n: number) =>
            n === 1 ? "1 día seguido" : `${n} días seguidos`,
        streakBest: (n: number) => `Tu récord: ${n}`,
        streakTotal: (n: number) =>
            n === 1 ? "1 día en total" : `${n} días en total`,
        streakToGo: (n: number) =>
            n === 1
                ? "1 día para el siguiente logro. No la cagues."
                : `${n} días para el siguiente logro. No la cagues.`,
        streakShare: "Presume tu racha",
        streakShareMessage: (days: number) =>
            `Llevo ${days} días seguidos viendo Hablando Huevadas 🔥 ¿tú qué, cro?`,

        favorites: "Favoritos",
        favoritesEmpty:
            "¿Qué esperas, csm? No has guardado ni una sola huevada.",
        favoritesEmptyAction: "Ir a chismear episodios",

        history: "Historial",
        historyEmpty: "Acá va a salir todo lo que veas. Por ahora, nada.",
        historyClear: "Limpiar",
        historyClearTitle: "¿Borramos todo?",
        historyClearBody: "Se va tu historial completo. No hay vuelta, cro.",
        historyClearConfirm: "Bórralo",

        settings: "Ajustes",
        settingsDaily: "Huevada del día",
        settingsDailyHint: "Un solo aviso al día. Ni uno más, palabra.",
        settingsHour: "¿A qué hora te jodemos?",
        expoGoNote: "En Expo Go solo llegan avisos locales. Cosas de la vida.",
    },

    notification: {
        optInTitle: "¿Te avisamos de la huevada del día?",
        optInBody:
            "Un aviso al día con el mejor clip. Nada de spam, y lo apagas cuando te amargue.",
        optInAccept: "Ya, avísame",
        optInDismiss: "Ahora no",
        blockedTitle: "Tienes los avisos apagados",
        blockedBody:
            "Los bloqueaste desde el sistema. Ábrelos en ajustes si quieres que te avisemos.",
        blockedAction: "Abrir ajustes",
        dailyTitle: "Huevada del día 🎙️",
        dailyFallback: "Hay un clip esperándote, cro.",
        streakTitle: "No rompas tu racha, csm 🔥",
        streakBody: (days: number) =>
            `Llevas ${days} días seguidos. Un clip y sigues vivo.`,
        comebackTitle: "Te perdiste, causa",
        comebackBody: "Hay huevadas nuevas y tú sin aparecer.",
    },

    share: {
        action: "Compartir",
        whatsapp: "Mándalo al grupo",
        whatsappLong: "Mándale esta ptada a tus patas por WhatsApp",
        copy: "Copiar enlace",
        copied: "Copiado, ya pégalo",
        /** Compact labels for the vertical rail in Shorts. */
        shortLabels: {
            favorite: "Guardar",
            whatsapp: "WhatsApp",
            share: "Compartir",
            copy: "Copiar",
            copied: "Copiado",
        },
        more: "Otras apps",
        sheetTitle: "Manda esta huevada",
        message: (title: string, clip: string, store: string) =>
            `😂 "${title}"\n\n${clip}\n\nMás huevadas acá 👉 ${store}`,
    },

    promo: {
        badge: "Comunidad",
        title: "Ayuda a que esto crezca, cro",
        body: "Comparte la app con tus patas y entras al sorteo de entradas del próximo show.",
        bullets: [
            "Más gente, más beneficios",
            "Más la usas, más la mejoramos",
            "Más compartes, más chances tienes",
        ],
        cta: "Compartir y sumar",
        dismiss: "Ahora no",
        legal: "Sorteo cada 1k usuarios nuevos activos por semana.",
    },

    favorite: {
        add: "Guardar en favoritos",
        remove: "Bota esa basurilla",
    },

    player: {
        play: "Haz clic acá, cro",
        resume: "Sigue donde lo dejaste",
        related: "Si te gustó esa, mira estas",
    },

    loading: {
        generic: "Aguanta la respiración, cjo... cargando.",
        catalog: "Sacando las huevadas del baúl...",
        player: "Prendiendo el micro...",
    },

    error: {
        generic:
            "¡Se cayó esta mrda! Vuelve a intentar antes de que me amargue.",
        retry: "Reintentar",
        notFoundTitle: "Esta pantalla no existe, cro",
        notFoundBody: "El enlace que abriste ya no lleva a ningún lado.",
        videoGoneTitle: "Ese clip se esfumó",
        videoGoneBody: "Ya no está disponible. Cosas que pasan.",
        invalidUrl: "Ese enlace está bamba",
        goHome: "Llévame al inicio",
    },

    common: {
        close: "Cerrar",
        cancel: "Cancelar",
        back: "Volver",
        views: (formatted: string) => formatted,
    },
} as const;

export type Copy = typeof COPY;
