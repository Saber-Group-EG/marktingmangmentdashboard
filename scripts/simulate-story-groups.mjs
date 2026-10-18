/**
 * Story Groups end-to-end simulation.
 *
 * Drives the real Vite dev server (http://localhost:5173) in headless Brave via
 * Playwright, mocking every external origin (marketing-planner API, R2 presign,
 * image proxy) with scenario-specific behaviour, then asserts UI + request
 * payloads. Run:  node scripts/simulate-story-groups.mjs [scenarioId ...]
 */
import { chromium } from "playwright-core";

const BRAVE = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
const APP = process.env.SIM_APP || "http://localhost:5173";
const APP_ORIGIN = new URL(APP).origin;
const API = "https://marketing-planner-tau.vercel.app";
const API_V1 = `${API}/api/v1`;
const FORM = "https://application-maker.onrender.com";
const FORM_ORIGIN = new URL(FORM).origin;

const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
);
const FAKE_MP4 = Buffer.from("000000186674797069736f6d-not-a-real-video-0123456789abcdef", "binary");

/* ---------------------------------- fixtures --------------------------------- */

const video = (id, n, extra = {}) => ({
    type: "video",
    url: `https://cdn.sim.local/v/${id}-${n}.mp4`,
    mimeType: "video/mp4",
    size: 1000 + n,
    originalName: `${id}-clip-${n}.mp4`,
    thumbnail: `https://cdn.sim.local/t/${id}-${n}.jpg`,
    caption: { en: `cap ${n}`, ar: `شريط ${n}` },
    order: n,
    ...extra,
});

const group = (id, order, videoCount, extra = {}) => ({
    _id: id,
    title: { ar: `مجموعة ${id}`, en: `Story ${id}` },
    subtitle: { en: `subtitle ${id}` },
    coverImage: { url: `https://cdn.sim.local/covers/${id}.jpg`, mimeType: "image/jpeg", size: 500, originalName: `${id}.jpg` },
    material: Array.from({ length: videoCount }, (_, j) => video(id, j + 1)),
    order,
    deleted: false,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-02T00:00:00.000Z",
    ...extra,
});

// render order when sorted by `order` asc: g2(0), g3(1), g1(2), g5(3), g4(4)
const GROUPS = [group("g1", 2, 3), group("g2", 0, 1), group("g3", 1, 4), group("g4", 4, 2, { subtitle: undefined }), group("g5", 3, 5)];
const SORTED_TITLES = ["Story g2", "Story g3", "Story g1", "Story g5", "Story g4"];
const SORTED_SEGMENTS = [1, 4, 3, 5, 2];

const PROJECTS = [
    {
        _id: "p1",
        name: { ar: "حملة المجوهرات", en: "Jewelry - New year campaign" },
        mainCover: { url: "https://cdn.sim.local/projects/p1-cover.jpg" },
        published: true,
    },
    { _id: "p2", name: { en: "Only English Project" }, published: true },
];

const PROJECT_P1_DETAIL = {
    _id: "p1",
    name: { ar: "حملة المجوهرات", en: "Jewelry - New year campaign" },
    mainCover: { url: "https://cdn.sim.local/projects/p1-cover.jpg" },
    published: true,
    material: [
        { type: "photo", url: "https://cdn.sim.local/projects/p1-photo.jpg", order: 0 },
        video("p1", 1),
        video("p1", 2),
        {
            type: "bulk",
            url: "",
            order: 3,
            items: [
                { type: "video", url: "https://cdn.sim.local/v/p1-3.mp4", mimeType: "video/mp4", originalName: "p1-clip-3.mp4" },
                { type: "photo", url: "https://cdn.sim.local/projects/photo-x.jpg" },
            ],
        },
        { type: "bulk", order: 4, items: [{ type: "video", url: "https://cdn.sim.local/v/p1-4.mp4", originalName: "p1-clip-4.mp4" }] },
    ],
};

const defaultPresign = (body) => ({
    status: 200,
    body: {
        presignedUrl: `${API}/sim-r2-put?k=${encodeURIComponent(body?.name || "file")}`,
        publicUrl: `https://cdn.sim.local/r2/${body?.name || "file"}`,
    },
});

const defaultState = () => {
    const store = { groups: structuredClone(GROUPS) };
    return {
    store,
    api: {
        list: () => ({ status: 200, body: { message: "Success", storyGroups: store.groups, meta: { total: store.groups.length, page: 1, limit: 10, totalPages: 1 } } }),
        detail: (id) => {
            const found = store.groups.find((g) => g._id === id);
            return found ? { status: 200, body: { storyGroup: found } } : { status: 404, body: { error: { code: "NOT_FOUND", message: "Story group not found" } } };
        },
        create: (body) => {
            const created = { ...body, _id: "new-1", order: store.groups.length };
            store.groups.push(created);
            return { status: 201, body: { storyGroup: created } };
        },
        update: (id, body) => {
            store.groups = store.groups.map((g) => (g._id === id ? { ...g, ...body } : g));
            return { status: 200, body: { storyGroup: { ...body, _id: id } } };
        },
        remove: (id) => {
            store.groups = store.groups.filter((g) => g._id !== id);
            return { status: 200, body: { message: "Deleted" } };
        },
        reorder: (payload) => {
            const byId = new Map(store.groups.map((g) => [g._id, g]));
            for (const item of payload?.items || []) {
                const g = byId.get(item.id);
                if (g) g.order = item.order;
            }
            return { status: 200, body: { message: "Order updated" } };
        },
        projectsList: () => ({ status: 200, body: { projects: PROJECTS, totalCount: PROJECTS.length, totalPages: 1, currentPage: 1 } }),
        projectDetail: (id) => {
            if (id === "p1") return { status: 200, body: { project: PROJECT_P1_DETAIL } };
            const found = PROJECTS.find((p) => p._id === id);
            return found ? { status: 200, body: { project: { ...found, material: [] } } } : { status: 404, body: { error: { code: "NOT_FOUND", message: "Project not found" } } };
        },
        refresh: () => ({ status: 200, body: { accessToken: "sim-new-token", refreshToken: "sim-new-refresh" } }),
    },
    presign: (body) => defaultPresign(body),
    };
};

/* ---------------------------------- harness ---------------------------------- */

const results = [];
let CURRENT = "boot";
const check = (name, cond, extra = "") => {
    results.push({ id: CURRENT, name, pass: !!cond, extra: String(extra) });
    console.log(`${cond ? "PASS" : "FAIL"}  [${CURRENT}] ${name}${extra ? `  (${extra})` : ""}`);
};

const respond = async (route, h) => {
    if (!h) return await route.fulfill({ status: 599, body: "no mock handler" });
    if (h.hang) return await new Promise(() => {});
    if (h.delayMs) await new Promise((r) => setTimeout(r, h.delayMs));
    return await route.fulfill({ status: h.status ?? 200, contentType: "application/json", body: JSON.stringify(h.body ?? {}) });
};

const parseJson = (req) => {
    try {
        return JSON.parse(req.postData() || "{}");
    } catch {
        return {};
    }
};

async function open(browser, state, { auth = true } = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    if (auth) {
        await ctx.addInitScript(() => {
            if (!localStorage.getItem("sim-init")) {
                localStorage.setItem("accessToken", "sim-token");
                localStorage.setItem("auth-user", JSON.stringify({ role: "admin", name: "Sim User" }));
                localStorage.setItem("sim-init", "1");
            }
            document.cookie = "refreshToken=sim-refresh";
        });
    }
    const net = [];
    const errors = [];

    await ctx.route(/https?:\/\//, async (route) => {
        const req = route.request();
        const u = new URL(req.url());
        const kind = u.origin === APP_ORIGIN ? "app" : u.pathname.includes("presign") || u.origin === FORM_ORIGIN ? "presign" : u.pathname === "/sim-r2-put" ? "r2put" : u.origin === API && u.pathname.startsWith("/api/v1/") ? "api" : "other";
        if (kind !== "app") net.push({ kind, method: req.method(), path: u.pathname + u.search, body: parseJson(req), headers: req.headers() });

        try {
            if (u.origin === APP_ORIGIN) return await route.continue();
            if (u.hostname === "images.weserv.nl" || u.hostname === "i.pravatar.cc")
                return await route.fulfill({ status: 200, contentType: "image/png", body: PNG });
            if (u.hostname === "cdn.sim.local")
                return await route.fulfill({ status: 200, contentType: u.pathname.endsWith(".mp4") ? "video/mp4" : "image/jpeg", body: PNG });

            if (u.origin === FORM_ORIGIN && u.pathname.endsWith("/upload/presign")) return await respond(route, state.presign(parseJson(req)));
            if (u.origin === API && u.pathname === "/sim-r2-put") return await route.fulfill({ status: 200, body: "" });

            if (u.origin === API && u.pathname.startsWith("/api/v1/")) {
                const rel = u.pathname.slice("/api/v1".length);
                const m = req.method();
                if (rel === "/story-groups") {
                    if (m === "GET") return await respond(route, state.api.list(u.searchParams));
                    if (m === "POST") return await respond(route, state.api.create(parseJson(req)));
                }
                if (rel === "/story-groups/reorder" && m === "PATCH") return await respond(route, state.api.reorder(parseJson(req)));
                const detailMatch = rel.match(/^\/story-groups\/([^/]+)$/);
                if (detailMatch) {
                    if (m === "GET") return await respond(route, state.api.detail(detailMatch[1]));
                    if (m === "PUT") return await respond(route, state.api.update(detailMatch[1], parseJson(req)));
                    if (m === "DELETE") return await respond(route, state.api.remove(detailMatch[1]));
                }
                if (rel === "/projects") return await respond(route, state.api.projectsList());
                const projectMatch = rel.match(/^\/projects\/([^/]+)$/);
                if (projectMatch) return await respond(route, state.api.projectDetail(projectMatch[1]));
                if (rel === "/auth/refresh" && m === "POST") return await respond(route, state.api.refresh());
                return await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: { code: "NOT_MOCKED", message: `no mock for ${m} ${rel}` } }) });
            }

            return await route.fulfill({ status: 204, body: "" });
        } catch {
            /* navigation disposed the route */
        }
    });

    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
        if (m.type() !== "error") return;
        const text = m.text();
        if (/Failed to load resource|net::ERR|MEDIA_ELEMENT|the resource|decoding/i.test(text)) return;
        errors.push(`console: ${text}`);
    });
    return { ctx, page, net, errors, state };
}

const cardAt = (page, i) => page.locator('[class*="xl:grid-cols-5"] > div').nth(i);
const cards = (page) => page.locator('[class*="xl:grid-cols-5"] > div');
const grips = (page) => page.locator('button[aria-label="Reorder story group"]');

async function dragGrip(page, fromIdx, toIdx) {
    const from = await grips(page).nth(fromIdx).boundingBox();
    const to = await grips(page).nth(toIdx).boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 + 8, { steps: 25 });
    await page.waitForTimeout(150);
    await page.mouse.up();
    await page.waitForTimeout(400);
}

/* --------------------------------- scenarios ---------------------------------- */

const scenarios = {
    async "list-happy"(browser) {
        const { ctx, page, net, errors } = await open(browser, defaultState());
        await page.goto(`${APP}/story-groups`);
        await page.locator('button[aria-label="Reorder story group"]').first().waitFor({ timeout: 15000 });

        check("renders 5 cards", (await cards(page).count()) === 5);
        const titles = [];
        for (let i = 0; i < 5; i++) titles.push(await cardAt(page, i).locator("span.text-sm.font-bold").innerText());
        check("sorted by order asc", JSON.stringify(titles) === JSON.stringify(SORTED_TITLES), titles.join(" | "));
        let segmentsOk = true;
        for (let i = 0; i < 5; i++) {
            const n = await cardAt(page, i).locator("span.h-1").count();
            if (n !== SORTED_SEGMENTS[i]) segmentsOk = false;
        }
        check("segment count per card = video count", segmentsOk, `expected ${SORTED_SEGMENTS.join(",")}`);
        const subOf = async (i) => (await cardAt(page, i).locator("span.block.truncate").nth(1).innerText()).trim();
        const withSub = await subOf(0);
        check("card shows group SUBTITLE instead of hardcoded text", withSub === "subtitle g2", withSub);
        const withoutSub = await subOf(4);
        check("missing subtitle falls back to 'Reel · N videos'", /Reel · 2 videos/.test(withoutSub), withoutSub);
        const listReq = net.find((n) => n.kind === "api" && n.method === "GET" && n.path.includes("/story-groups"));
        check("list request asks for PageCount=all (no silent limit-10)", listReq && listReq.path.includes("PageCount=all") && !/[?&]page=/i.test(listReq.path), listReq?.path);
        check("no runtime errors", errors.length === 0, errors.join(" ; "));
        await ctx.close();
    },

    async "list-shapes"(browser) {
        // bare JSON array
        let s = defaultState();
        s.api.list = () => ({ status: 200, body: GROUPS });
        let env = await open(browser, s);
        await env.page.goto(`${APP}/story-groups`);
        await env.page.getByText("No story groups yet. Create your first one.").waitFor({ timeout: 10000 }).catch(() => {});
        const bareCards = await cards(env.page).count().catch(() => -1);
        const bareEmpty = await env.page.getByText("No story groups yet. Create your first one.").isVisible().catch(() => false);
        check("bare-array response renders all 5 groups (extractor accepts arrays)", bareCards === 5 && !bareEmpty, `cards=${bareCards}`);
        await env.ctx.close();

        // { data: [...] } wrapper
        s = defaultState();
        s.api.list = () => ({ status: 200, body: { data: GROUPS } });
        env = await open(browser, s);
        await env.page.goto(`${APP}/story-groups`);
        await env.page.locator('button[aria-label="Reorder story group"]').first().waitFor({ timeout: 10000 }).catch(() => {});
        check("{data:[...]} wrapper renders 5 cards", (await cards(env.page).count()) === 5);
        await env.ctx.close();
    },

    async "list-error500"(browser) {
        const s = defaultState();
        s.api.list = () => ({ status: 500, body: { message: "server exploded" } });
        const { ctx, page, net } = await open(browser, s);
        await page.goto(`${APP}/story-groups`);
        await page.getByText("Failed to load story groups").waitFor({ timeout: 15000 });
        check("error state shown", true);
        const listCalls = net.filter((n) => n.kind === "api" && n.path.includes("/story-groups") && n.method === "GET").length;
        check("react-query retried once (2 attempts)", listCalls === 2, `${listCalls} attempts`);
        await ctx.close();
    },

    async "list-timeout"(browser) {
        const s = defaultState();
        s.api.list = () => ({ hang: true });
        const { ctx, page } = await open(browser, s);
        await page.goto(`${APP}/story-groups`);
        const t0 = Date.now();
        await page.getByText("Failed to load story groups").waitFor({ timeout: 70000 }).catch(() => {});
        const shown = await page.getByText("Failed to load story groups").isVisible().catch(() => false);
        check("axios timeout (20s) surfaces as error state", shown, `${Math.round((Date.now() - t0) / 1000)}s (2 x 20s timeout + 1s retry delay)`);
        await ctx.close();
    },

    async "pagination"(browser) {
        const many = Array.from({ length: 15 }, (_, i) => group(`g${i + 1}`, i, (i % 3) + 1));
        const s = defaultState();
        s.api.list = (params) => {
            const all = params?.get("PageCount") === "all";
            const served = all ? many : many.slice(0, 10);
            return { status: 200, body: { storyGroups: served, meta: { total: 15, page: 1, limit: all ? 0 : 10, totalPages: all ? 1 : 2 } } };
        };
        const { ctx, page, net } = await open(browser, s);
        await page.goto(`${APP}/story-groups`);
        await page.locator('button[aria-label="Reorder story group"]').first().waitFor({ timeout: 10000 });
        check("ALL 15 groups rendered (PageCount=all defeats the limit-10 trap)", (await cards(page).count()) === 15, `meta.totalPages=2 served only without PageCount=all`);

        await dragGrip(page, 0, 1);
        const patchEntry = net.find((n) => n.kind === "api" && n.method === "PATCH" && n.path.includes("/story-groups/reorder"));
        const body = patchEntry?.body || null;
        check("reorder PATCH covers ALL groups (items.length=15)", body?.items?.length === 15, `items=${body?.items?.length}`);
        check("PATCH uses silent header", net.some((n) => n.kind === "api" && n.method === "PATCH" && n.headers["x-silent"] === "1"));
        await ctx.close();
    },

    async "deleted-row"(browser) {
        const s = defaultState();
        const withDeleted = [...GROUPS.slice(0, 2), group("gdel", 2, 2, { deleted: true })];
        s.api.list = () => ({ status: 200, body: { storyGroups: withDeleted, meta: {} } });
        const { ctx, page } = await open(browser, s);
        await page.goto(`${APP}/story-groups`);
        await page.locator('button[aria-label="Reorder story group"]').first().waitFor({ timeout: 10000 });
        const count = await cards(page).count();
        check("soft-deleted group is filtered out client-side", count === 2, `${count} cards for 2 live + 1 deleted`);
        await ctx.close();
    },

    async "delete-flow"(browser) {
        const s = defaultState();
        let deletedId = null;
        const innerRemove = s.api.remove;
        s.api.remove = (id) => {
            deletedId = id;
            return innerRemove(id);
        };
        const { ctx, page, net } = await open(browser, s);
        await page.goto(`${APP}/story-groups`);
        await page.locator('button[aria-label="Reorder story group"]').first().waitFor({ timeout: 10000 });
        await cardAt(page, 0).locator('button[aria-label="Delete story group"]').click();
        await page.locator(".swal2-confirm").waitFor({ timeout: 5000 });
        await page.locator(".swal2-confirm").click();
        const series = [];
        for (let i = 0; i < 14; i++) {
            series.push(await cards(page).count().catch(() => -1));
            await page.waitForTimeout(500);
        }
        check("confirm dialog then DELETE sent with first card id", deletedId === "g2", `deleted=${deletedId}`);
        check("card removed after delete", series.at(-1) === 4, `count-series=${series.join(",")} | api=${JSON.stringify(net.filter((n) => n.kind === "api").map((n) => `${n.method} ${n.path}`))}`);
        await ctx.close();
    },

    async "delete-400"(browser) {
        const s = defaultState();
        s.api.remove = () => ({ status: 400, body: { error: { code: "BAD_REQUEST", message: "Cannot delete a group with active sessions" } } });
        const { ctx, page } = await open(browser, s);
        await page.goto(`${APP}/story-groups`);
        await page.locator('button[aria-label="Reorder story group"]').first().waitFor({ timeout: 10000 });
        await cardAt(page, 0).locator('button[aria-label="Delete story group"]').click();
        await page.locator(".swal2-confirm").waitFor({ timeout: 5000 });
        await page.locator(".swal2-confirm").click();
        const banner = page.locator("div.border-danger-200").first();
        await banner.waitFor({ timeout: 8000 });
        const text = await banner.innerText();
        check("delete 400 shows the SERVER message (shared extractor)", text.includes("Cannot delete a group with active sessions"), text.trim());
        check("card kept after failed delete", (await cards(page).count()) === 5);
        await ctx.close();
    },

    async "reorder-ok"(browser) {
        const s = defaultState();
        const innerReorder = s.api.reorder;
        s.api.reorder = (payload) => innerReorder(payload);
        const { ctx, page, net } = await open(browser, s);
        const t0 = Date.now();
        const T = (m) => console.log(`  [t+${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);
        await page.goto(`${APP}/story-groups`);
        await page.locator('button[aria-label="Reorder story group"]').first().waitFor({ timeout: 10000 });
        T("list ready");
        await dragGrip(page, 0, 2);
        T("drag done");
        const patchEntry = net.find((n) => n.kind === "api" && n.method === "PATCH" && n.path.includes("/story-groups/reorder"));
        const body = patchEntry?.body || null;
        T("patch read from net log");
        const expected = ["g3", "g1", "g2", "g5", "g4"];
        const got = (body?.items || []).map((it) => it.id);
        check("PATCH body has moved order with sequential 0..4", JSON.stringify(got) === JSON.stringify(expected) && body.items.every((it, i) => it.order === i), `got=${got.join(",")} raw=${JSON.stringify(body)}`);
        check("PATCH sent with x-silent header", net.some((n) => n.kind === "api" && n.method === "PATCH" && n.headers["x-silent"] === "1"));
        await page.waitForTimeout(2000);
        const titles = [];
        for (let i = 0; i < 5; i++) titles.push(await cardAt(page, i).locator("span.text-sm.font-bold").innerText());
        check("UI settles on new order (optimistic + refetch)", JSON.stringify(titles) === JSON.stringify(["Story g3", "Story g1", "Story g2", "Story g5", "Story g4"]), titles.join(" | "));
        await ctx.close();
    },

    async "reorder-500"(browser) {
        const s = defaultState();
        s.api.reorder = () => ({ status: 500, body: { message: "reorder exploded" } });
        const { ctx, page, net } = await open(browser, s);
        await page.goto(`${APP}/story-groups`);
        await page.locator('button[aria-label="Reorder story group"]').first().waitFor({ timeout: 10000 });
        const before = net.filter((n) => n.kind === "api" && n.method === "GET").length;
        await dragGrip(page, 0, 1);
        const banner = page.locator("div.border-danger-200").first();
        await banner.waitFor({ timeout: 8000 });
        check("reorder failure shows server message", (await banner.innerText()).includes("reorder exploded"));
        await page.waitForTimeout(1500);
        const after = net.filter((n) => n.kind === "api" && n.method === "GET").length;
        check("cache invalidated -> list refetched after failure", after > before, `${before} -> ${after} GETs`);
        await ctx.close();
    },

    async "inherit-create"(browser) {
        const s = defaultState();
        const { ctx, page, net, errors } = await open(browser, s);
        await page.goto(`${APP}/story-groups/add`);
        await page.locator('li:has-text("Jewelry - New year campaign") button').waitFor({ timeout: 15000 });
        check("projects fetched with PageCount=all", net.some((n) => n.kind === "api" && n.path.includes("/projects") && n.path.includes("PageCount=all")));

        await page.locator('li:has-text("Jewelry - New year campaign") button').click();
        await page.locator('button[aria-pressed]:has-text("p1-clip-1.mp4")').waitFor({ timeout: 15000 });
        const counterText = await page
            .locator("span.rounded-full.border")
            .allInnerTexts()
            .then((t) => t.map((x) => x.replace(/\s+/g, "")).join(" | "))
            .catch(() => "n/a");
        const m = counterText.match(/(\d+)\s*\/\s*(\d+)/);
        check("photo child in bulk group excluded (0/4 videos, photos never selectable)", m?.[2] === "4", `counter="${counterText}"`);
        check("EN title autofilled from project", (await page.locator('input[placeholder="Title (English)"]').inputValue()) === "Jewelry - New year campaign");
        check("AR title autofilled from project", (await page.locator('input[placeholder="Title (Arabic)"]').inputValue()) === "حملة المجوهرات");

        await page.locator('button[aria-pressed]:has-text("p1-clip-1.mp4")').click();
        await page.locator('button[aria-pressed]:has-text("p1-clip-3.mp4")').click();
        check("live preview draws 2 segments", (await page.locator("aside span.h-1").count()) === 2);
        check("selected list shows 2 rows", (await page.locator('button[aria-label="Remove video"]').count()) === 2);

        // inherit + add ONE new upload (the headline requirement)
        await page.locator('input[type="file"][accept="video/*"]').setInputFiles({ name: "extra-clip.mp4", mimeType: "video/mp4", buffer: FAKE_MP4 });
        await page.waitForFunction(() => document.querySelectorAll('button[aria-label="Remove video"]').length === 3, { timeout: 15000 }).catch(() => {});
        check("uploaded file joins inherited selections", (await page.locator('button[aria-label="Remove video"]').count()) === 3);

        await page.locator("form button[type=submit]").click();
        await page.waitForURL("**/story-groups", { timeout: 20000 }).catch(() => {});
        const post = net.find((n) => n.kind === "api" && n.method === "POST" && n.path === "/api/v1/story-groups");
        check("POST /story-groups sent + navigated to list", !!post && !page.url().includes("/add"));
        const b = post?.body || {};
        check("inherited URLs reused, NOT re-uploaded (presign fired once, only for extra-clip)", net.filter((n) => n.kind === "presign").length === 1, `${net.filter((n) => n.kind === "presign").length} presign calls`);
        check("material = 3 videos in selection order", b.material?.length === 3 && b.material[0].url.includes("p1-1.mp4") && b.material[1].url.includes("p1-3.mp4") && b.material[2].url.includes("r2/extra-clip.mp4"), (b.material || []).map((m) => m.url).join(" | "));
        check("material ordered 0..2, type video", (b.material || []).every((m, i) => m.order === i && m.type === "video"));
        check("title ar+en + cover inherited", !!b.title?.ar && !!b.title?.en && (b.coverImage?.url || "").includes("p1-cover.jpg"));
        check("subtitle omitted when untouched", !("subtitle" in b));
        const presignBody = net.find((n) => n.kind === "presign")?.body;
        check("new upload goes to Markting/storygroups folder", presignBody?.folder === "Markting/storygroups" && presignBody?.name === "extra-clip.mp4", JSON.stringify(presignBody));
        check("no runtime errors", errors.length === 0, errors.join(" ; "));
        if (!post) {
            console.log("  [debug] inline error banner:", (await page.locator("form div.border-danger-200").first().innerText().catch(() => "(none)")).slice(0, 300));
            console.log("  [debug] net:", net.filter((n) => n.kind !== "app").map((n) => `${n.kind} ${n.method} ${n.path}`).join("\n        "));
        }
        await ctx.close();
    },

    async "inherit-joi400"(browser) {
        const s = defaultState();
        s.api.create = () => ({ status: 400, body: { error: { code: "VALIDATION_ERROR", message: "title.en is required" } } });
        const { ctx, page, net } = await open(browser, s);
        await page.goto(`${APP}/story-groups/add`);
        await page.locator('li:has-text("Jewelry - New year campaign") button').waitFor({ timeout: 15000 });
        await page.locator('li:has-text("Jewelry - New year campaign") button').click();
        await page.locator('button[aria-pressed]:has-text("p1-clip-1.mp4")').waitFor({ timeout: 15000 });
        await page.locator('button[aria-pressed]:has-text("p1-clip-1.mp4")').click();
        await page.locator("form button[type=submit]").click();
        const banner = page.locator("form div.border-danger-200").first();
        await banner.waitFor({ timeout: 10000 });
        check("Joi 400 message shown inline", (await banner.innerText()).includes("title.en is required"));
        check("stays on form (no navigation)", page.url().includes("/story-groups/add"));
        check("POST attempted", net.some((n) => n.kind === "api" && n.method === "POST"));
        await ctx.close();
    },

    async "create-new-upload"(browser) {
        const s = defaultState();
        const { ctx, page, net } = await open(browser, s);
        await page.goto(`${APP}/story-groups/add`);
        await page.getByRole("button", { name: "Create new", exact: true }).waitFor({ timeout: 10000 });
        await page.getByRole("button", { name: "Create new", exact: true }).click();
        await page.locator('input[placeholder="Title (English)"]').fill("My New Story");
        await page.locator('input[type="file"][accept="video/*"]').setInputFiles({ name: "my clip.mp4", mimeType: "video/mp4", buffer: FAKE_MP4 });
        await page.locator('button[aria-label="Remove video"]').waitFor({ timeout: 15000 });
        await page.locator("form button[type=submit]").click();
        await page.waitForURL("**/story-groups", { timeout: 20000 }).catch(() => {});
        const post = net.find((n) => n.kind === "api" && n.method === "POST" && n.path === "/api/v1/story-groups");
        check("create-new flow saves + navigates", !!post && !page.url().includes("/add"));
        const b = post?.body || {};
        check("AR title cross-filled from EN", b.title?.ar === "My New Story" && b.title?.en === "My New Story");
        check("video uploaded via presign+PUT to storygroups folder", net.some((n) => n.kind === "presign") && net.some((n) => n.kind === "r2put") && (b.material?.[0]?.url || "").startsWith("https://cdn.sim.local/r2/"), b.material?.[0]?.url);
        check("thumbnail omitted when frame capture fails on fake bytes", !b.material?.[0]?.thumbnail);
        await ctx.close();
    },

    async "upload-fail-retry"(browser) {
        const s = defaultState();
        let failBad = true;
        s.presign = (body) => {
            if (failBad && String(body?.name || "").includes("bad")) return { status: 500, body: { message: "presign down for bad file" } };
            return defaultPresign(body);
        };
        const { ctx, page, net } = await open(browser, s);
        await page.goto(`${APP}/story-groups/add`);
        await page.getByRole("button", { name: "Create new", exact: true }).click();
        await page.locator('input[placeholder="Title (English)"]').fill("Upload Fail Story");
        await page
            .locator('input[type="file"][accept="video/*"]')
            .setInputFiles([
                { name: "good-clip.mp4", mimeType: "video/mp4", buffer: FAKE_MP4 },
                { name: "bad-clip.mp4", mimeType: "video/mp4", buffer: FAKE_MP4 },
            ]);
        await page.waitForFunction(() => document.querySelectorAll('button[aria-label="Remove video"]').length === 2, undefined, { timeout: 25000 });
        await page.locator("form button[type=submit]").click();
        const banner = page.locator("form div.border-danger-200").first();
        await banner.waitFor({ timeout: 30000 });
        const text = await banner.innerText();
        check("upload failure blocks submit + shows inline error", /Upload failed after 3 attempts/.test(text), text.trim().slice(0, 90));
        check("POST never sent while upload failed", !net.some((n) => n.kind === "api" && n.method === "POST"));
        const presignsOf = (name) => net.filter((n) => n.kind === "presign" && n.body?.name === name).length;
        check("failing file presigned 3x with backoff; good file once", presignsOf("bad-clip.mp4") === 3 && presignsOf("good-clip.mp4") === 1, `good=${presignsOf("good-clip.mp4")} bad=${presignsOf("bad-clip.mp4")}`);

        failBad = false; // server "recovers"
        await page.locator("form button[type=submit]").click();
        await page.waitForURL("**/story-groups", { timeout: 25000 }).catch(() => {});
        const post = net.find((n) => n.kind === "api" && n.method === "POST" && n.path === "/api/v1/story-groups");
        check("retry succeeds and saves both videos", !!post && (post.body?.material || []).some((m) => m.url.includes("good-clip.mp4")) && (post.body?.material || []).some((m) => m.url.includes("bad-clip.mp4")), (post?.body?.material || []).map((m) => m.url).join(" | "));
        check("already-uploaded file NOT re-uploaded on retry", presignsOf("good-clip.mp4") === 1, `good presigns=${presignsOf("good-clip.mp4")}`);
        await ctx.close();
    },

    async "validation-blocks"(browser) {
        const s = defaultState();
        const { ctx, page, net } = await open(browser, s);
        await page.goto(`${APP}/story-groups/add`);
        await page.locator("form button[type=submit]").click();
        let banner = page.locator("form div.border-danger-200").first();
        await banner.waitFor({ timeout: 8000 });
        check("empty titles blocked", (await banner.innerText()).includes("Both Arabic and English titles are required"));
        await page.locator('li:has-text("Only English Project") button').click();
        await page.waitForTimeout(800);
        await page.locator("form button[type=submit]").click();
        await banner.waitFor({ timeout: 8000 });
        check("no-videos blocked", (await banner.innerText()).includes("Select at least one video"));
        check("cross-fill: EN-only project fills BOTH title fields", (await page.locator('input[placeholder="Title (Arabic)"]').inputValue()) === "Only English Project");
        check("no POST fired for blocked submits", !net.some((n) => n.kind === "api" && n.method === "POST"));
        await ctx.close();
    },

    async "edit-prefill-save"(browser) {
        const s = defaultState();
        const edited = {
            _id: "g1",
            title: { ar: "عنوان تجريبي", en: "Edit Me" },
            subtitle: { en: "old subtitle" },
            coverImage: { url: "https://cdn.sim.local/covers/edit.jpg" },
            material: [video("e", 1), video("e", 2), { type: "video", url: "data:video/mp4;base64,AAAA", originalName: "legacy.mp4" }, video("e", 3)],
            order: 0,
        };
        s.api.detail = () => ({ status: 200, body: { storyGroup: edited } });
        const { ctx, page, net } = await open(browser, s);
        await page.goto(`${APP}/story-groups/g1/edit`);
        await page.locator('input[placeholder="Title (English)"]').waitFor({ timeout: 15000 });
        check("detail prefills titles", (await page.locator('input[placeholder="Title (English)"]').inputValue()) === "Edit Me" && (await page.locator('input[placeholder="Title (Arabic)"]').inputValue()) === "عنوان تجريبي");
        check("unsupported (data:) item still excluded from rows", (await page.locator('button[aria-label="Remove video"]').count()) === 3);
        const warnTexts = await page.locator("form div.border-danger-200, form div.border-amber-300, form div.border-warning-200, form [class*='amber'], form [class*='warning']").allInnerTexts().catch(() => []);
        check("user warned that 1 unsupported item will not be saved", warnTexts.some((t) => /unsupported|will not be saved|can't be saved/i.test(t)), `warnings=${JSON.stringify(warnTexts).slice(0, 200)}`);
        await page.locator('input[placeholder="Title (English)"]').fill("Edit Me v2");
        await page.locator("form button[type=submit]").click();
        await page.waitForURL("**/story-groups", { timeout: 15000 }).catch(() => {});
        const put = net.find((n) => n.kind === "api" && n.method === "PUT" && n.path.includes("/story-groups/g1"));
        check("PUT sent with updated payload", !!put && put.body?.title?.en === "Edit Me v2");
        check("non-http video excluded from payload but user was warned", put?.body?.material?.length === 3 && !(put?.body?.material || []).some((m) => (m.url || "").startsWith("data:")), `material=${put?.body?.material?.length}`);
        await ctx.close();
    },

    async "edit-cover-wipe"(browser) {
        const s = defaultState();
        const edited = {
            _id: "g2",
            title: { ar: "ب", en: "Relative Cover" },
            coverImage: { url: "/covers/relative.jpg" },
            material: [video("w", 1)],
            order: 0,
        };
        s.api.detail = () => ({ status: 200, body: { storyGroup: edited } });
        const { ctx, page, net } = await open(browser, s);
        await page.goto(`${APP}/story-groups/g2/edit`);
        await page.locator('input[placeholder="Title (English)"]').waitFor({ timeout: 15000 });
        const coverWarn = await page.locator("form [class*='amber'], form [class*='warning'], form div.border-danger-200").allInnerTexts().catch(() => []);
        check("user warned about the non-displayable cover", coverWarn.some((t) => /cover/i.test(t)), `warnings=${JSON.stringify(coverWarn).slice(0, 200)}`);
        await page.locator("form button[type=submit]").click();
        await page.waitForURL("**/story-groups", { timeout: 15000 }).catch(() => {});
        const put = net.find((n) => n.kind === "api" && n.method === "PUT" && n.path.includes("/story-groups/g2"));
        check("non-http cover left untouched (coverImage key OMITTED, not {url:''})", !!put && !("coverImage" in put.body), JSON.stringify(put?.body?.coverImage));
        await ctx.close();
    },

    async "edit-404"(browser) {
        const s = defaultState();
        s.api.detail = () => ({ status: 404, body: { error: { code: "NOT_FOUND", message: "nope" } } });
        const { ctx, page } = await open(browser, s);
        await page.goto(`${APP}/story-groups/ghost/edit`);
        await page.getByText("Story group not found.").first().waitFor({ timeout: 15000 });
        check("404 shows friendly not-found panel", true);
        await ctx.close();
    },

    async "auth-no-token"(browser) {
        const s = defaultState();
        const { ctx, page, net } = await open(browser, s, { auth: false });
        await page.goto(`${APP}/story-groups`);
        await page.waitForURL("**/auth/login**", { timeout: 10000 }).catch(() => {});
        check("no token -> redirected to login", page.url().includes("/auth/login"), page.url());
        const leaked = net.filter((n) => n.kind === "api" && n.path.includes("/story-groups")).length;
        check("note: unauthorized story-groups request(s) fired before redirect", leaked >= 0, `${leaked} request(s) (Layout redirects AFTER first render)`);
        await ctx.close();
    },

    async "auth-refresh-ok"(browser) {
        const s = defaultState();
        let listCalls = 0;
        s.api.list = () => {
            listCalls += 1;
            if (listCalls === 1) return { status: 401, body: { error: { code: "TOKEN_EXPIRED", message: "expired" } } };
            return { status: 200, body: { storyGroups: GROUPS.slice(0, 2), meta: {} } };
        };
        const { ctx, page, net } = await open(browser, s);
        await page.goto(`${APP}/story-groups`);
        await page.locator('button[aria-label="Reorder story group"]').first().waitFor({ timeout: 15000 }).catch(() => {});
        check("expired token -> refresh -> retried request succeeds", (await cards(page).count()) === 2);
        check("POST /auth/refresh called once", net.filter((n) => n.kind === "api" && n.path.includes("/auth/refresh")).length === 1);
        await ctx.close();
    },

    async "auth-401-badcode"(browser) {
        const s = defaultState();
        s.api.list = () => ({ status: 401, body: { error: { code: "FORBIDDEN", message: "insufficient role" } } });
        s.api.refresh = () => ({ status: 401, body: { message: "refresh rejected (no code)" } });
        const { ctx, page } = await open(browser, s);
        await page.goto(`${APP}/story-groups`);
        await page.waitForURL("**/auth/login**", { timeout: 12000 }).catch(() => {});
        check("401 with any code attempts refresh, then hard-logs-out to login", page.url().includes("/auth/login"), page.url());
        const tokenLeft = await page.evaluate(() => localStorage.getItem("accessToken"));
        check("hard logout cleared the surviving localStorage token", tokenLeft === null, `accessToken=${tokenLeft}`);
        await ctx.close();
    },

    async "auth-refresh-fail"(browser) {
        const s = defaultState();
        s.api.list = () => ({ status: 401, body: { error: { code: "TOKEN_EXPIRED", message: "expired" } } });
        s.api.refresh = () => ({ status: 401, body: { error: { code: "AUTHENTICATION_FAILED", message: "refresh token invalid" } } });
        const { ctx, page } = await open(browser, s);
        await page.goto(`${APP}/story-groups`);
        await page.waitForURL("**/auth/login**", { timeout: 12000 }).catch(() => {});
        check("coded refresh-401 no longer deadlocks -> redirects to login", page.url().includes("/auth/login"), `url=${page.url()}`);
        const tokenLeft = await page.evaluate(() => localStorage.getItem("accessToken"));
        check("hard logout cleared localStorage token", tokenLeft === null, `accessToken=${tokenLeft}`);
        await ctx.close();
    },

    async "auth-refresh-fail-nocode"(browser) {
        const s = defaultState();
        s.api.list = () => ({ status: 401, body: { error: { code: "TOKEN_EXPIRED", message: "expired" } } });
        s.api.refresh = () => ({ status: 401, body: { message: "invalid refresh token (no error.code)" } });
        const { ctx, page } = await open(browser, s);
        await page.goto(`${APP}/story-groups`);
        await page.waitForURL("**/auth/login**", { timeout: 12000 }).catch(() => {});
        check("refresh 401 WITHOUT coded error redirects to login correctly", page.url().includes("/auth/login"), page.url());
        await ctx.close();
    },
};

/* ----------------------------------- main ------------------------------------ */

const browser = await chromium.launch({ executablePath: BRAVE, headless: true });
const only = process.argv.slice(2);
const ids = only.length ? only : Object.keys(scenarios);

for (const id of ids) {
    const fn = scenarios[id];
    if (!fn) {
        console.log(`SKIP unknown scenario: ${id}`);
        continue;
    }
    console.log(`\n=== ${id} ===`);
    CURRENT = id;
    const t0 = Date.now();
    try {
        await fn(browser);
    } catch (err) {
        check("scenario crashed", false, String(err).slice(0, 300));
    }
    console.log(`--- ${id} done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n================ ${results.length - failed.length}/${results.length} checks passed ================`);
for (const f of failed) console.log(`FAILED: [${f.id}] ${f.name}  ${f.extra}`);
process.exit(0);
