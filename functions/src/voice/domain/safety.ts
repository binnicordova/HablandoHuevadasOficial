/**
 * The last gate before a line is voiced.
 *
 * The app writes the text (with its own LLM), so this service treats it as
 * untrusted: whatever the text says, it will be spoken in a real person's
 * voice, so the bar is "would they be fine hearing this under their name".
 * Small and readable on purpose; it is not a moderation product, keep the
 * rate limits on and read the reports.
 */

export interface Verdict {
    ok: boolean;
    reason?: string;
}

const normalize = (text: string): string =>
    text
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/\s+/g, " ");

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

/** A voice must never be made to endorse a person, party or product. */
const ENDORSEMENT = [
    /\bvota(r|n)? por\b/,
    /\bvotaria por\b/,
    /\bapoyo a\b.*\b(candidato|partido)\b/,
    /\bcompra(r|n)? (el|la|los|las)\b.*\b(cripto|bitcoin|token)\b/,
];

export const checkSpeakable = (line: string): Verdict => {
    const text = normalize(line);
    if (
        HARD_BLOCK.some((p) => p.test(text)) ||
        ENDORSEMENT.some((p) => p.test(text))
    )
        return {ok: false, reason: "blocked_output"};
    return {ok: true};
};
