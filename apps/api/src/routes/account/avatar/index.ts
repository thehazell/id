import { Hono } from "hono";

import deleteRoute from "./delete";
import getRoute from "./get";
import putRoute from "./put";

const route = new Hono<{ Bindings: Env }>();

route.route("/", getRoute);
route.route("/", putRoute);
route.route("/", deleteRoute);
export default route;
