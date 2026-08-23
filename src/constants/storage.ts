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
};

export const STORAGE_ID: StorageIdType = {
    favorites: "hh.favorites.v1",
    history: "hh.history.v1",
    streak: "hh.streak.v1",
    settings: "hh.settings.v1",
    engagement: "hh.engagement.v1",
    recentSearches: "hh.recentSearches.v1",
    notifications: "hh.notifications.v1",
};
