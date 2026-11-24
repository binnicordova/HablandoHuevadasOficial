type StorageIdType = {
    /** Ids the user marked as favourites. */
    favorites: string;
    /** Recently watched entries with resume position. */
    history: string;
    /** Daily open streak. */
    streak: string;
    /** User controlled preferences (notifications, reminder hour, autoplay). */
    settings: string;
    /** Counters used to time prompts so we never ask before delivering value. */
    engagement: string;
    /** Search terms the user typed, for one-tap repeat searches. */
    recentSearches: string;
    /** Notification memory: fatigue window, back-off and per-slot opens. */
    notifications: string;
    /** ETag and last check of the downloaded catalog (see src/catalog). */
    catalogSync: string;
    /** The group chat with Jorge and Ricardo (see src/chat). */
    chat: string;
    /** Anonymous id the voice server rate-limits on. */
    chatInstall: string;
    /** Cached list of personajes (voices) from the voice service. */
    chatVoices: string;
    /** Which personajes the user is chatting with. */
    chatSelection: string;
};

export const STORAGE_ID: StorageIdType = {
    favorites: "hh.favorites.v1",
    history: "hh.history.v1",
    streak: "hh.streak.v1",
    settings: "hh.settings.v1",
    engagement: "hh.engagement.v1",
    recentSearches: "hh.recentSearches.v1",
    notifications: "hh.notifications.v1",
    catalogSync: "hh.catalogSync.v1",
    chat: "hh.chat.v1",
    chatInstall: "hh.chatInstall.v1",
    chatVoices: "hh.chatVoices.v1",
    chatSelection: "hh.chatSelection.v1",
};
