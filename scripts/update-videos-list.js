const fs = require("node:fs");
const path = require("node:path");
const {spawn} = require("node:child_process");

const dataPath = path.join(__dirname, "..", "assets/data", "data.json");
const channelUrls = {
    videos: "https://www.youtube.com/@HablandoHuevadasOficial/videos",
    shorts: "https://www.youtube.com/@HablandoHuevadasOficial/shorts",
};

async function fetchVideosForUrl(url) {
    return new Promise((resolve) => {
        console.log(`Fetching videos from ${url}...`);
        const ytDlp = spawn("yt-dlp", ["-j", "--flat-playlist", url]);

        let videoData = "";
        ytDlp.stdout.on("data", (data) => {
            videoData += data.toString();
        });

        ytDlp.stderr.on("data", (data) => {
            console.error(`stderr for ${url}: ${data}`);
        });

        ytDlp.on("close", (code) => {
            if (code !== 0) {
                console.log(
                    `yt-dlp process for ${url} exited with code ${code}`
                );
                // Resolve with an empty array if a single URL fails
                resolve([]);
                return;
            }

            const videos = videoData
                .split("\n")
                .filter((line) => line)
                .map((line) => {
                    const video = JSON.parse(line);
                    return {
                        id: video.id,
                        link: video.webpage_url,
                        title: video.title,
                        description: video.description,
                        duration: video.duration,
                        duration_string: video.duration_string,
                        view_count: video.view_count,
                        thumbnail:
                            video.thumbnails && video.thumbnails.length > 0
                                ? video.thumbnails[video.thumbnails.length - 1]
                                      .url
                                : null,
                        thumbnails: video.thumbnails,
                        channel: video.channel,
                        channel_id: video.channel_id,
                        uploader: video.uploader,
                        uploader_id: video.uploader_id,
                    };
                });
            resolve(videos);
        });
    });
}

const fetchAllVideos = async () => {
    try {
        console.log("Fetching all videos from Hablando Huevadas...");
        const data = {
            channel: "Hablando Huevadas",
        };

        for (const [key, url] of Object.entries(channelUrls)) {
            const videos = await fetchVideosForUrl(url);
            data[key] = videos;
        }

        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

        console.log(
            `Successfully updated data.json with ${data.videos.length} videos and ${data.shorts.length} shorts.`
        );
    } catch (error) {
        console.error("Failed to update video list:", error);
    }
};

fetchAllVideos();
