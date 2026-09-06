import { Hono } from "hono";

import getRoute from "./get";
import postRoute from "./post";

const route = new Hono<{ Bindings: Env }>();

route.route("/", getRoute);
route.route("/", postRoute);

export default route;
