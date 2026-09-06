import { Hono } from "hono";

import patchRoute from "./patch";
import deleteRoute from "./delete";

const route = new Hono<{ Bindings: Env }>();

route.route("/", patchRoute);
route.route("/", deleteRoute);

export default route;
