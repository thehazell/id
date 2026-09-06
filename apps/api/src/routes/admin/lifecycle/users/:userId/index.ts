import { Hono } from "hono";

import lifecycleRoute from "./lifecycle";

const route = new Hono<{ Bindings: Env }>();

route.route("/lifecycle", lifecycleRoute);

export default route;
