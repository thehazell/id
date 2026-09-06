import { Hono } from "hono";

import usersRoute from "./users";

const route = new Hono<{ Bindings: Env }>();

route.route("/users", usersRoute);

export default route;
