import { Hono } from "hono";

import getRoute from "./get";
import revokeAllRoute from "./revoke-all";
import sessionRoute from "./:id";

const route = new Hono<{ Bindings: Env }>();

route.route("/", getRoute);
route.route("/revoke-all", revokeAllRoute);
route.route("/:id", sessionRoute);

export default route;
