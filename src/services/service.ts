import data from "@assets/data/data.json";
import type {Video} from "@/models/video";

export const fetchVideos = (): Promise<Video[]> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(data.videos as Video[]);
        }, 3000);
    });
};

export const fetchShorts = (): Promise<Video[]> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(data.shorts as Video[]);
        }, 3000);
    });
};
