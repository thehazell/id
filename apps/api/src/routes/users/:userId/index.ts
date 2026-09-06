import { Hono } from "hono";

import avatarRoute from "./avatar";

const route = new Hono<{ Bindings: Env }>();

route.route("/avatar", avatarRoute);

export default route;
