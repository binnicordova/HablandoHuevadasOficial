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
        search: "Buscar",
        favorites: "Guardados",
        me: "Mi zona",
    },

    home: {
        greeting: "Ya pues, causa",
        dailyBadge: "Huevada del día",
        dailyHint: "Cambia a la medianoche. No te hagas el vivo.",
        nowPlaying: "Sonando ahorita",
        continueAction: "Ver todo",
        shuffle: "Sorpréndeme, cjo",
        emptyContinue:
            "No has visto nada todavía. Dale play arriba, no seas tímido.",
    },

    shorts: {
        title: "Shorts",
        hint: "Desliza, cro. Como en el TikTok pero sin bailes.",
        muted: "Sin volumen, sube el sonido",
    },

    /**
     * The full catalog. Lives in Buscar, linked from the bottom of Inicio, so
     * the same two strings are never written twice.
     */
    catalog: {
        /** Keyed by the kind filter, so the heading never lies about the list. */
        title: {
            all: "Todo el catálogo",
            video: "Todos los episodios",
            short: "Todos los shorts",
        },
        subtitle: (n: number) => `${n} huevadas completas. Suerte.`,
        homeCta: "Ver los episodios completos",
    },

    search: {
        placeholder: "Busca un episodio, un invitado, una ptada",
        recent: "Lo que buscaste antes",
        results: (n: number) => (n === 1 ? "1 resultado" : `${n} resultados`),
        emptyTitle: "Nada, cro. Cero.",
        emptyHint: "Escríbelo bien o busca a otro invitado. No adivinamos.",
        filters: {all: "Todo", videos: "Episodios", shorts: "Shorts"},
        clear: "Borrar búsqueda",
    },

    /**
     * Rail copy, shared by Inicio y Guardados.
     *
     * Cada título es una razón para darle play, no una etiqueta. "Recomendados"
     * no le dice nada a nadie; "porque viste X" sí. Y el subtítulo es el que
     * mete el codazo — ahí vive la mala palabra, nunca en la instrucción.
     */
    rails: {
        continueTitle: "Seguías viendo esto",
        continueSubtitle: "Lo dejaste botado. Termínalo.",
        forYouTitle: "Hecho para ti, cro",
        forYouSubtitle: "Armado con las huevadas que te tragas. No juzgamos.",
        becauseTitle: (title: string) => `Porque viste "${title}"`,
        becauseSubtitle: "Más de la misma mrda buena.",
        starterTitle: "Empieza por acá, novato",
        starterSubtitle: "Los que enganchan a cualquiera. Ni pienses tanto.",
        trendingTitle: "Lo más visto de siempre",
        trendingSubtitle: "Los clásicos que todo el mundo cita en el grupo.",
        lovedTitle: "Los que más gustan",
        lovedSubtitle: "Puro like. Acá nadie se queja.",
        gemsTitle: "Joyas escondidas",
        gemsSubtitle: "Pocas vistas y buenazas. Tú te las estás perdiendo.",
        seasonTitle: (season: string) => `Sigues clavado en ${season}`,
        seasonSubtitle: "Te faltan estos de esa temporada, cjo.",
        seasonMoreTitle: (season: string) => `Más de ${season}`,
        seasonMoreSubtitle: "Ya estás metido ahí, sigue nomás.",
        quickTitle: "Un ratito nomás",
        quickSubtitle: 'Shorts para cuando dices "solo uno" y son las 3am.',
        vaultTitle: "Del baúl",
        vaultSubtitle: "Episodios viejos que no viste ni de casualidad.",
        unfinishedTitle: "Guardaste y no terminaste",
        unfinishedSubtitle:
            "Acumulas como si fueras a verlos. Termínalos, csm.",
        likeFavoritesTitle: "Más de lo que guardas",
        likeFavoritesSubtitle: "Mismo humor, otra ptada distinta.",
        seeAll: "Ver todo",
    },

    favorites: {
        title: "Guardados",
        count: (n: number) =>
            n === 1 ? "1 huevada guardada" : `${n} huevadas guardadas`,
        emptyTitle: "Cero guardados, csm",
        emptyBody:
            "Dale al corazón en cualquier clip y aparece acá. No es tan difícil, cro.",
        emptyAction: "Ir a ver huevadas",
        emptyFilterTitle: "Nada de este tipo",
        emptyFilterBody: "Cambia el filtro o guarda algo, tú sabrás.",
        shuffle: "Una guardada al azar",
        rails: "Y ya que estás acá...",
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

        favorites: "Guardados",
        favoritesAction: "Ver todo",
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
        settingsDaily: "Avisos",
        settingsDailyHint:
            "Te mandamos clips que sí te van a gustar. Tú mandas cuántos.",
        settingsHour: "¿A qué hora te jodemos?",
        settingsLevel: "¿Qué tan pesados nos ponemos?",
        settingsLevels: {
            chill: "Suave",
            normal: "Normal",
            hardcore: "Bien pesado",
        },
        settingsLevelHint: (perDay: number) =>
            perDay === 1
                ? "1 aviso al día, y solo si vale la pena."
                : `Hasta ${perDay} avisos al día, en tus horas.`,
        settingsLevelBackoff:
            "Si los ignoras, bajamos solos. No somos pegajosos.",
        settingsAutoplay: "Reproducción automática",
        settingsAutoplayHint:
            "Los shorts arrancan al deslizar, y cuando un episodio acaba sigue el que viene.",
        expoGoNote: "En Expo Go solo llegan avisos locales. Cosas de la vida.",
    },

    notification: {
        optInTitle: "¿Te avisamos de la huevada del día?",
        optInBody:
            "Te mandamos los clips que van contigo, a la hora que tú digas. Si los ignoras, avisamos menos. Y lo apagas cuando te amargue.",
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

        /**
         * Push variants, one bucket per intent.
         *
         * Several a day only works if they never read like the same message.
         * The planner picks a variant by hash, so the wording rotates on its
         * own and two pushes in one day are never twins. `subject` is the clip
         * title, except for the streak buckets where it is the day count.
         */
        push: {
            daily: [
                {
                    title: "Huevada del día 🎙️",
                    body: (subject: string) => `Hoy toca: ${subject}`,
                },
                {
                    title: "La del día ya está lista",
                    body: (subject: string) =>
                        `${subject}. Dale play antes de que te la cuenten.`,
                },
                {
                    title: "Ya pues, causa 🎙️",
                    body: (subject: string) =>
                        `${subject} te está esperando hace rato.`,
                },
            ],
            resume: [
                {
                    title: "Lo dejaste botado, cro",
                    body: (subject: string) =>
                        `Te falta terminar "${subject}". Un ratito nomás.`,
                },
                {
                    title: "¿Y el final qué? 🤨",
                    body: (subject: string) =>
                        `"${subject}" quedó a medias por tu culpa.`,
                },
                {
                    title: "Termina lo que empezaste",
                    body: (subject: string) =>
                        `"${subject}" sigue en pausa esperándote.`,
                },
            ],
            discovery: [
                {
                    title: "Una que no has visto 👀",
                    body: (subject: string) =>
                        `${subject}. Vas a llorar de risa.`,
                },
                {
                    title: "Te falta esta, cjo",
                    body: (subject: string) =>
                        `${subject}. Ni la conocías, ¿no?`,
                },
                {
                    title: "Del baúl 🎁",
                    body: (subject: string) =>
                        `${subject}. Vieja pero buenaza.`,
                },
            ],
            short: [
                {
                    title: "Un ratito nomás ⏱️",
                    body: (subject: string) =>
                        `${subject}. Dura menos que tu break.`,
                },
                {
                    title: "Short rápido 📲",
                    body: (subject: string) =>
                        `${subject}. Y vuelves a lo tuyo.`,
                },
                {
                    title: "Para el almuerzo 🍽️",
                    body: (subject: string) => `${subject}. Un minuto y ya.`,
                },
            ],
            streak: [
                {
                    title: "No rompas tu racha, csm 🔥",
                    body: (subject: string) =>
                        `Llevas ${subject} días seguidos. Un clip y sigues vivo.`,
                },
                {
                    title: "Se te va la racha 😰",
                    body: (subject: string) =>
                        `${subject} días al hilo y lo vas a botar hoy. Qué pena.`,
                },
                {
                    title: "Falta poquito 🔥",
                    body: (subject: string) =>
                        `Un clip y tu racha de ${subject} días sigue en pie.`,
                },
            ],
            comeback: [
                {
                    title: "Te perdiste, causa",
                    body: (subject: string) =>
                        `Mientras no venías subieron esto: ${subject}`,
                },
                {
                    title: "¿Ya te olvidaste de nosotros? 🥺",
                    body: (subject: string) =>
                        `${subject}. Vuelve, no seas malo.`,
                },
                {
                    title: "Volvió el que nunca se fue",
                    body: (subject: string) =>
                        `Te dejamos ${subject} para que te pongas al día.`,
                },
            ],
            favorite: [
                {
                    title: "De las que te gustan 💚",
                    body: (subject: string) =>
                        `${subject}. Igualita a las que guardas.`,
                },
                {
                    title: "Sabemos qué te gusta 👀",
                    body: (subject: string) => `${subject}. Te la debíamos.`,
                },
                {
                    title: "Más de lo tuyo",
                    body: (subject: string) =>
                        `${subject}. Misma temporada, misma mrda buena.`,
                },
            ],
            milestone: [
                {
                    title: "¡Eres una bestia! 🏆",
                    body: (subject: string) =>
                        `${subject} días seguidos. Presúmelo en tu zona.`,
                },
                {
                    title: "Récord personal 🔥",
                    body: (subject: string) =>
                        `${subject} días. Ni el trabajo te dura tanto.`,
                },
                {
                    title: "Logro desbloqueado",
                    body: (subject: string) =>
                        `${subject} días seguidos viendo huevadas. Respeto.`,
                },
            ],
        },
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

        /* The end-of-video handoff: the moment a session either continues or dies. */
        nextUp: "A continuación",
        nextUpIn: (seconds: number) =>
            seconds === 1 ? "Arranca en 1..." : `Arranca en ${seconds}...`,
        nextUpCancel: "Déjalo ahí",
        nextUpHint: "Dale play y sigue la maratón.",
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
