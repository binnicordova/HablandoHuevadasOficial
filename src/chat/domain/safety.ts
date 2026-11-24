/**
 * Content policy for what the voices say.
 *
 * Two gates: the user's message before the LLM sees it, and every generated
 * line before it is voiced. Anything voiced is a real person's voice, so the
 * bar is "would they be fine hearing this under their name".
 *
 * A first line of defence, deliberately small and readable. It is not a
 * moderation product: keep the rate limits on and read the reports.
 */

export interface Verdict {
    ok: boolean;
    reason?: string;
    /** A line the app can show in place of a reply. */
    notice?: string;
}

const normalize = (text: string): string =>
    text
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/\s+/g, " ");

const CARE =
    "Oe, causa, eso suena serio y acá no sabemos ayudarte como mereces. " +
    "Habla con alguien de confianza o llama a la Línea 113 (Minsa, Perú), " +
    "opción 5. Te la estamos poniendo en serio.";
const REFUSE = "De eso no hablamos, cro. Pregunta otra huevada.";

const SELF_HARM = [
    /\bsuicid/,
    /\bmatarme\b/,
    /\bquitarme la vida\b/,
    /\bquiero morir/,
    /\bno quiero vivir\b/,
    /\bcortarme\b/,
];

const HARD_BLOCK = [
    /\bcholo de mierda\b/,
    /\bnegro de mierda\b/,
    /\bserrano de mierda\b/,
    /\bmaricon de mierda\b/,
    /\bnazi\b/,
    /\bheil hitler\b/,
    /\bviolar\b/,
    /\bviolacion\b/,
    /\bpedofil/,
    /\bmenor(es)? de edad\b.*\b(sexo|desnud)/,
    /\bnin[oa]s? .*\b(sexo|desnud)/,
];

/** The voices must never be made to endorse a person, party or product. */
const ENDORSEMENT = [
    /\bvota(r|n)? por\b/,
    /\bvotaria por\b/,
    /\bapoyo a\b.*\b(candidato|partido)\b/,
    /\bcompra(r|n)? (el|la|los|las)\b.*\b(cripto|bitcoin|token)\b/,
];

/** Attempts to make the model a parrot or to reach its instructions. */
const INJECTION = [
    /ignora (todas? )?(las|tus) (instrucciones|reglas)/,
    /olvida (todas? )?(las|tus) (instrucciones|reglas)/,
    /ignore (all )?(previous|prior|your) (instructions|rules)/,
    /system prompt/,
    /prompt del sistema/,
    /\bdi exactamente\b/,
    /\brepite (despues de mi|lo siguiente|esto)\b/,
    /\bsay exactly\b/,
    /\brepeat after me\b/,
];

const matches = (patterns: RegExp[], text: string): boolean =>
    patterns.some((pattern) => pattern.test(text));

export const checkInput = (message: string): Verdict => {
    const text = normalize(message);
    if (matches(SELF_HARM, text))
        return {ok: false, reason: "self_harm", notice: CARE};
    if (matches(HARD_BLOCK, text))
        return {ok: false, reason: "blocked_content", notice: REFUSE};
    if (matches(INJECTION, text))
        return {ok: false, reason: "prompt_injection", notice: REFUSE};
    return {ok: true};
};

export const checkOutput = (line: string): Verdict => {
    const text = normalize(line);
    if (matches(HARD_BLOCK, text) || matches(ENDORSEMENT, text))
        return {ok: false, reason: "blocked_output"};
    return {ok: true};
};
