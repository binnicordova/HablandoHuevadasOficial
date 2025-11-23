export type Video = {
    id: string;
    link: string;
    title: string;
    description: string | null;
    duration: number;
    duration_string: string;
    view_count: number | null;
    thumbnail: string | null;
    thumbnails: {url: string; height: number; width: number}[] | null;
    channel: string | null;
    channel_id: string | null;
    uploader: string | null;
    uploader_id: string | null;
};
