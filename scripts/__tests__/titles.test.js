const {parseTitle, likeRatio, toSentenceCase} = require("../lib/titles");

describe("parseTitle", () => {
    it("splits the current convention into a clean title and a season", () => {
        expect(
            parseTitle(
                "HABLANDO HUEVADAS - Duodécima Temporada [LA HISTORIA DE JORGE Y EL GUARDIA]"
            )
        ).toMatchObject({
            title_clean: "La historia de Jorge y el guardia",
            season: "Duodécima Temporada",
            season_number: 12,
            season_short: "T12",
            series: "Hablando Huevadas",
        });

        expect(
            parseTitle(
                "HABLANDO HUEVADAS - Duodécima Temporada [EL INGENIERO Y SU MARIDO]"
            )
        ).toMatchObject({
            title_clean: "El ingeniero y su marido",
            season_number: 12,
        });
    });

    it("keeps the numbered season when the title also says bonus track", () => {
        expect(
            parseTitle(
                "Bonus Track HABLANDO HUEVADAS - Undécima Temporada [JORGITO Y JORGITA]"
            )
        ).toMatchObject({
            title_clean: "Jorgito y Jorgita",
            season_number: 11,
        });
    });

    it("falls back to a special season when there is no number", () => {
        expect(
            parseTitle("HABLANDO HUEVADAS - BONUS TRACK [EL KEKE MÁS SECO]")
        ).toMatchObject({
            title_clean: "El keke más seco",
            season: "Bonus Track",
            season_number: null,
            season_short: "BONUS",
        });
    });

    it("reads the old formats: parentheses, trailing season, spin-offs", () => {
        expect(
            parseTitle("Quinta Temporada (EL PAPÁ DE RICHAVO ESTÁ EN DROGAS)")
        ).toMatchObject({
            title_clean: "El papá de Richavo está en drogas",
            season_number: 5,
        });

        expect(
            parseTitle("Jorge escupe la gaseosa - Segunda Temporada")
        ).toMatchObject({
            title_clean: "Jorge escupe la gaseosa",
            season_number: 2,
        });

        expect(
            parseTitle("Baños en Japón - Hablando Huevadas CORONATOUR")
        ).toMatchObject({
            title_clean: "Baños en Japón",
            season: "CoronaTour",
            series: "CoronaTour",
        });
    });

    it("files the episode-numbered 2019 run as season one", () => {
        expect(parseTitle("Vigésimo Tercer Episodio")).toMatchObject({
            episode_number: 23,
            season_number: 1,
        });
        expect(parseTitle("Cuarto Programa")).toMatchObject({
            episode_number: 4,
            season_number: 1,
        });
    });

    it("survives the broken punctuation in the early catalog", () => {
        expect(
            parseTitle(
                'La Boa inmortal-"Cumpliendo sueños"]-Décimo Quinto Episodio'
            )
        ).toMatchObject({
            title_clean: "Cumpliendo sueños",
            episode_number: 15,
        });
    });

    it("strips hashtags from shorts and keeps them as their own field", () => {
        expect(
            parseTitle(
                "El niño anticuchero 😂 #hablandohuevadas #jorgeluna #ricardomendoza"
            )
        ).toMatchObject({
            title_clean: "El niño anticuchero 😂",
            hashtags: ["hablandohuevadas", "jorgeluna", "ricardomendoza"],
            season: null,
        });
    });

    it("never returns an empty title", () => {
        expect(parseTitle("Hablando Huevadas 2.0").title_clean).toBeTruthy();
        expect(parseTitle("").title_clean).toBe("");
    });
});

describe("toSentenceCase", () => {
    it("lowercases shouted titles but keeps the cast as proper nouns", () => {
        expect(toSentenceCase("JORGE Y RICARDO EN LIMA")).toBe(
            "Jorge y Ricardo en Lima"
        );
    });

    it("leaves mixed-case titles alone", () => {
        expect(toSentenceCase("El esclavo nuevo perdió su billetera")).toBe(
            "El esclavo nuevo perdió su billetera"
        );
    });

    it("keeps acronyms shouted", () => {
        expect(toSentenceCase("HABLANDO HUEVADAS FT. DJ PELIGRO")).toContain(
            "DJ"
        );
    });
});

describe("likeRatio", () => {
    it("returns likes per view rounded to four decimals", () => {
        expect(likeRatio(107334, 7500000)).toBe(0.0143);
    });

    it("returns null when either side is missing", () => {
        expect(likeRatio(null, 100)).toBeNull();
        expect(likeRatio(10, null)).toBeNull();
        expect(likeRatio(10, 0)).toBeNull();
    });
});
