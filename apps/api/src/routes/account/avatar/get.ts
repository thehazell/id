import { Hono } from "hono";

import { requireAuth } from "@middleware/auth";

const route = new Hono<{ Bindings: Env }>();

route.get("/", requireAuth, async (c) => {
    const user = c.get("user");

    if (!user.profileImageKey) {
        return c.json({ error: "Profile picture not found." }, 404);
    }

    const object = await c.env.PROFILE_BUCKET.get(user.profileImageKey);

    if (!object) {
        return c.json({ error: "Profile picture not found." }, 404);
    }

    const headers = new Headers();

    object.writeHttpMetadata(headers);
    headers.set("ETag", object.httpEtag);
    headers.set("Cache-Control", "private, max-age=3600");

    return new Response(object.body, {
        headers,
    });
});

export default route;
