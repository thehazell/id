import { Hono } from "hono";

import revokeRoute from "./revoke";

const route = new Hono<{ Bindings: Env }>();

route.route("/revoke", revokeRoute);

export default route;
