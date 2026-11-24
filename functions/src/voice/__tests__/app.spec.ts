import type {AddressInfo} from "node:net";
import {afterEach, describe, expect, it} from "vitest";
import {createApp} from "../http/app";
import {makeDeps} from "./fakes";

const INSTALL = "a".repeat(24);

let close: (() => void) | undefined;
afterEach(() => close?.());

const serve = async (ctx = makeDeps()) => {
    const server = createApp(ctx.deps).listen(0);
    close = () => server.close();
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const call = (
        path: string,
        init: {
            method?: string;
            body?: unknown;
            install?: string;
            accept?: string;
        } = {}
    ) =>
        fetch(base + path, {
            method: init.method ?? (init.body ? "POST" : "GET"),
            headers: {
                "Content-Type": "application/json",
                ...(init.install === ""
                    ? {}
                    : {"X-Install-Id": init.install ?? INSTALL}),
                ...(init.accept ? {Accept: init.accept} : {}),
            },
            body: init.body ? JSON.stringify(init.body) : undefined,
        });
    return {ctx, call, base};
};

describe("auth and validation", () => {
    it("needs an install id", async () => {
        const {call} = await serve();
        expect((await call("/v1/voices", {install: ""})).status).toBe(400);
    });

    it("checks the shared key when one is configured", async () => {
        const {call} = await serve(makeDeps({apiKey: "s3cret"}));
        expect((await call("/v1/voices")).status).toBe(401);
    });

    it("answers unknown routes and bad JSON without leaking details", async () => {
        const {call, base} = await serve();
        expect((await call("/v1/nope")).status).toBe(404);
        const bad = await fetch(`${base}/v1/speak`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Install-Id": INSTALL,
            },
            body: "{oops",
        });
        expect(bad.status).toBe(400);
        expect(await bad.json()).toEqual({error: "bad request"});
    });
});

describe("GET /v1/voices", () => {
    it("lists the voices in Storage", async () => {
        const {call} = await serve();
        const body = await (await call("/v1/voices")).json();
        expect(body.voices.map((v: {id: string}) => v.id)).toContain(
            "cindy-sample"
        );
        const ricardo = body.voices.find(
            (v: {id: string}) => v.id === "ricardo-sample"
        );
        expect(ricardo).toMatchObject({
            slug: "ricardo",
            persona: "El flaco sarcástico.",
        });
    });
});

describe("POST /v1/warm", () => {
    it("wakes the TTS and waits for it", async () => {
        const ctx = makeDeps();
        const {call} = await serve(ctx);
        expect((await call("/v1/warm", {method: "POST"})).status).toBe(204);
        expect(ctx.tts.warmed).toBe(1);
    });

    it("answers 502 when the TTS will not wake, and needs the same auth", async () => {
        const ctx = makeDeps();
        ctx.tts.failWarm = true;
        const {call} = await serve(ctx);
        expect((await call("/v1/warm", {method: "POST"})).status).toBe(502);
        expect(
            (await call("/v1/warm", {method: "POST", install: ""})).status
        ).toBe(400);
    });
});

describe("POST /v1/speak", () => {
    it("speaks exactly the text it is given, in the chosen voice", async () => {
        const {ctx, call} = await serve();
        const body = await (
            await call("/v1/speak", {
                body: {voice: "cindy-sample", text: "Hola mundo"},
            })
        ).json();
        expect(body).toMatchObject({voice: "cindy-sample", text: "Hola mundo"});
        expect(ctx.tts.calls).toEqual([
            {voice: "cindy-sample", text: "Hola mundo"},
        ]);
    });

    it("streams the audio itself when the caller asks for audio", async () => {
        const {call} = await serve();
        const res = await call("/v1/speak", {
            body: {voice: "jorge-sample", text: "Hola"},
            accept: "audio/mp4",
        });
        expect(res.headers.get("content-type")).toBe("audio/mp4");
        expect(await res.text()).toContain("audio:jorge-sample:Hola");
    });

    it("rate limits per install", async () => {
        const {call} = await serve();
        const speak = (install?: string) =>
            call("/v1/speak", {
                body: {voice: "jorge-sample", text: "hola"},
                install,
            });
        await speak();
        await speak();
        expect((await speak()).status).toBe(429);
        expect((await speak("b".repeat(24))).status).toBe(200);
    });

    it("404s an unknown voice and 422s text the filter rejects", async () => {
        const {call} = await serve();
        expect(
            (await call("/v1/speak", {body: {voice: "x-sample", text: "hola"}}))
                .status
        ).toBe(404);
        expect(
            (
                await call("/v1/speak", {
                    body: {voice: "jorge-sample", text: "Vota por Fulano"},
                })
            ).status
        ).toBe(422);
    });
});

describe("audio and reports", () => {
    it("only serves content-hash names, never paths", async () => {
        const {call} = await serve();
        expect((await call("/v1/audio/..%2Fvoices%2Fx.m4a")).status).toBe(404);
        expect((await call(`/v1/audio/${"0".repeat(64)}.m4a`)).status).toBe(
            404
        );
    });

    it("stores a report for a human to read", async () => {
        const {ctx, call} = await serve();
        const res = await call("/v1/report", {
            body: {speaker: "jorge", text: "feo"},
        });
        expect(res.status).toBe(204);
        expect(ctx.reports[0]).toMatchObject({
            speaker: "jorge",
            install: "aaaaaaaa",
        });
    });
});
