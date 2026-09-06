import { Hono } from "hono";

import getRoute from "./get";
import registerRoute from "./register";
import loginRoute from "./login";
import passkeyRoute from "./:id";

const route = new Hono<{ Bindings: Env }>();

route.route("/", getRoute);
route.route("/register", registerRoute);
route.route("/login", loginRoute);
route.route("/:id", passkeyRoute);

export default route;
