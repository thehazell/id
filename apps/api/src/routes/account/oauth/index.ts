import { Hono } from "hono";

import grantsRoute from "./grants";

const route = new Hono<{ Bindings: Env }>();

route.route("/grants", grantsRoute);

export default route;
