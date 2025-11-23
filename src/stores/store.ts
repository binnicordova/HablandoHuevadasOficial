import {atomWithStorage} from "jotai/utils";
import type {Video} from "@/models/video";

export const videosAtom = atomWithStorage<Video[]>("videos", []);
export const shortsAtom = atomWithStorage<Video[]>("shorts", []);
