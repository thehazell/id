import { Hono } from "hono";

import userRoute from "./:userId";

const route = new Hono<{ Bindings: Env }>();

route.route("/:userId", userRoute);

export default route;
