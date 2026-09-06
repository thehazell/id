import { Hono } from "hono";

import optionsRoute from "./options";
import verifyRoute from "./verify"

const route = new Hono<{ Bindings: Env }>();

route.route("/options", optionsRoute);
route.route("/verify", verifyRoute)

export default route;
