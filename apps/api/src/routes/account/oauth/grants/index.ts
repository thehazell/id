import { Hono } from "hono";

import getRoute from "./get";
import clientRoute from "./:clientId";

const route = new Hono<{ Bindings: Env }>();

route.route("/", getRoute);
route.route("/:clientId", clientRoute);

export default route;
