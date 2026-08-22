import type {AudioSource} from "expo-audio";

export type SoundPadSpec = {
    id: string;
    label: string;
    /** Short line shown under the label. Keep it to three or four words. */
    hint?: string;
    /** Accent used for the pad's glow. */
    tone: "lime" | "hot" | "cyan";
    /**
     * `require()` of a file in `assets/sounds/`. Omit it and the pad renders
     * locked — that is the slot waiting for its audio file.
     */
    source?: AudioSource;
};

/**
 * Soundboard manifest.
 *
 * Only the pads with a `source` can play. The repository ships exactly one
 * audio file (`notification_sound.wav`), so it is the only wired pad; the rest
 * are labelled slots. To activate one, drop an `.m4a` or `.wav` into
 * `assets/sounds/` and add its `require()` below — no other change is needed.
 *
 * Audio for the show's catchphrases has to be clipped and cleared by whoever
 * owns the rights; it is not something that can be generated here.
 */
export const SOUNDBOARD: SoundPadSpec[] = [
    {
        id: "chicharra",
        label: "La chicharra",
        hint: "Suena y ya",
        tone: "lime",
        source: require("../../assets/sounds/notification_sound.wav"),
    },
    {id: "keke", label: "El keke más seco", hint: "Clásico", tone: "hot"},
    {
        id: "brujeria",
        label: "Brujería en vivo",
        hint: "Novena temporada",
        tone: "cyan",
    },
    {
        id: "padrastro",
        label: "Dale tiempo, padrastro",
        hint: "Short",
        tone: "lime",
    },
    {id: "risa-jorge", label: "Risa de Jorge", hint: "Infaltable", tone: "hot"},
    {
        id: "risa-ricardo",
        label: "Risa de Ricardo",
        hint: "Infaltable",
        tone: "cyan",
    },
    {id: "aplauso", label: "Aplausos", hint: "Del público", tone: "lime"},
    {id: "abucheo", label: "Abucheo", hint: "Cuando la cagas", tone: "hot"},
    {id: "tarola", label: "Tarola", hint: "Ba dum tss", tone: "cyan"},
];
