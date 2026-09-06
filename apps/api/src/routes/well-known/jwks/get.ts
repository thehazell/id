import { Hono } from "hono";

import { getPublicJwk } from "@/lib/oauth/keys";

const route = new Hono<{ Bindings: Env }>();

route.get("/", (c) => {
    const jwk = getPublicJwk(c.env.OIDC_PRIVATE_KEY);

    return c.json({
        keys: [jwk],
    });
});

export default route;
