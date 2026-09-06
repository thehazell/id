import { Hono } from "hono";

import profile from "./profile";
import profileAvatar from "./avatar";
import oauthAccountRoute from "./oauth";
import password from "./password";

const account = new Hono<{ Bindings: Env }>();

account.route("/profile", profile);
account.route("/profile/avatar", profileAvatar);
account.route("/oauth", oauthAccountRoute);
account.route("/password", password);

export default account;
