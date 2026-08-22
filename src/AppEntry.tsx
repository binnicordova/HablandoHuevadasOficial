import {initBackgroundFetch} from "./hooks/useBackgroundFetch";
import {registerNotificationHandler} from "./utils/notification";

// Must run before the first notification can arrive; both calls are no-ops in
// environments that do not support them (Expo Go, web).
registerNotificationHandler();
initBackgroundFetch();

import "expo-router/entry";
