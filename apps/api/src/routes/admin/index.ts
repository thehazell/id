import { Hono } from "hono";
import bootstrap from "./bootstrap";
import lifecycle from "./lifecycle";
import users from "./users";

const admin = new Hono<{ Bindings: Env }>();

admin.route("/bootstrap", bootstrap);
admin.route("/", lifecycle);
admin.route("/users", users)

export default admin;
