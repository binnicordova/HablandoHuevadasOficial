/** "user" or the slug of a personaje, e.g. "ricardo". */
export type Speaker = string;

/** Mirrors the server's cap, so the composer can refuse before the network. */
export const MAX_MESSAGE_CHARS = 280;

/** How many past messages go along with a new one for context. */
export const HISTORY_WINDOW = 6;

/** Past this, the oldest messages (and their audio) are dropped. */
export const MAX_STORED_MESSAGES = 80;

export type ChatMessage = {
    id: string;
    speaker: Speaker;
    /** Display name of the personaje who spoke, for personaje notes. */
    name?: string;
    text: string;
    createdAt: number;
    /** Voice notes only: the local file the audio was saved to. */
    audioUri?: string;
    durationMs?: number;
    /** User messages only. */
    delivery?: "sent" | "failed";
};

export const isFromVoice = (message: ChatMessage): boolean =>
    message.speaker !== "user";

export const normalizeDraft = (draft: string): string =>
    draft.replace(/\s+/g, " ").trim();

export const canSend = (draft: string): boolean => {
    const text = normalizeDraft(draft);
    return text.length > 0 && text.length <= MAX_MESSAGE_CHARS;
};

export type HistoryEntry = {speaker: Speaker; text: string};

/** The last few settled messages, oldest first, in the shape the API takes. */
export const toHistory = (
    messages: readonly ChatMessage[],
    window = HISTORY_WINDOW
): HistoryEntry[] =>
    messages
        .filter((m) => m.delivery !== "failed")
        .slice(-window)
        .map(({speaker, text}) => ({speaker, text}));

/** Keeps the newest `limit`; returns what was dropped so its audio can go. */
export const trimMessages = (
    messages: readonly ChatMessage[],
    limit = MAX_STORED_MESSAGES
): {kept: ChatMessage[]; dropped: ChatMessage[]} => {
    if (messages.length <= limit) return {kept: [...messages], dropped: []};
    const cut = messages.length - limit;
    return {kept: messages.slice(cut), dropped: messages.slice(0, cut)};
};

let counter = 0;
export const newMessageId = (): string => {
    counter += 1;
    return `${Date.now().toString(36)}-${counter.toString(36)}`;
};
