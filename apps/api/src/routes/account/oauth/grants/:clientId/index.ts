import { Hono } from "hono";

import deleteRoute from "./delete";

const route = new Hono<{ Bindings: Env }>();

route.route("/", deleteRoute);

export default route;
