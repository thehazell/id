import { Hono } from "hono";

import jwksRoute from "./jwks";
import openIdConfigurationRoute from "./openid-configuration";

const route = new Hono<{ Bindings: Env }>();

route.route("/jwks.json", jwksRoute);
route.route("/openid-configuration", openIdConfigurationRoute);

export default route;
