import { Hono } from "hono";

import patchRoute from "./patch";

const route = new Hono<{ Bindings: Env }>();

route.route("/", patchRoute);

export default route;
