import { Hono } from "hono";

import { userinfo } from "./handler";

const route = new Hono<{ Bindings: Env }>();

route.get("/", userinfo);

export default route;
