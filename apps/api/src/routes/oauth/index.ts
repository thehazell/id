import { Hono } from "hono";

import authorize from "./authorize";
import clients from "./clients";
import introspect from "./introspect";
import revoke from "./revoke";
import token from "./token";
import userinfo from "./userinfo";
import approve from "./approve";
import avatar from "./avatar";
import details from "./details";
import grant from "./grant";

const oauthRoute = new Hono<{
	Bindings: Env;
}>();

oauthRoute.route("/authorize", authorize);
oauthRoute.route("/clients", clients);
oauthRoute.route("/introspect", introspect);
oauthRoute.route("/revoke", revoke);
oauthRoute.route("/token", token);
oauthRoute.route("/userinfo", userinfo);
oauthRoute.route("/approve", approve);
oauthRoute.route("/avatar", avatar);
oauthRoute.route("/details", details);
oauthRoute.route("/grant", grant);
export default oauthRoute;
