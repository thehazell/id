import { Hono } from "hono";

import getRoute from "./get";
import postRoute from "./post";
import clientRoute from "./:id";

const route = new Hono<{ Bindings: Env }>();

route.route("/", getRoute);
route.route("/", postRoute);
route.route("/:id", clientRoute);

export default route;
