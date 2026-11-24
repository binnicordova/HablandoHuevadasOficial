import type {ChatMessage} from "@/chat/domain/message";
import type {VoiceProfile} from "@/chat/domain/voice";
import {STORAGE_ID} from "@/constants/storage";
import {persistedAtom} from "@/stores/persist";

export const chatMessagesAtom = persistedAtom<ChatMessage[]>(
    STORAGE_ID.chat,
    []
);

/** Last list of personajes the service returned, so the picker works offline. */
export const cachedVoicesAtom = persistedAtom<VoiceProfile[]>(
    STORAGE_ID.chatVoices,
    []
);

/** Ids of the personajes the user is talking to. */
export const selectedVoiceIdsAtom = persistedAtom<string[]>(
    STORAGE_ID.chatSelection,
    []
);
