import { Hono } from "hono";

import deleteRoute from "./delete";
import patchRoute from "./patch";

const route = new Hono<{ Bindings: Env }>();

route.route("/", patchRoute);
route.route("/", deleteRoute);

export default route;
