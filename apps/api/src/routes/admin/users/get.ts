import { Hono } from "hono";

import { createDb } from "@/db";
import { getUsers } from "@/lib/user";
import { requireAdmin } from "@/middleware/auth";

const route = new Hono<{ Bindings: Env }>();

route.get("/", requireAdmin, async (c) => {
	const db = createDb(c.env.DB);
	const users = await getUsers(db);

	return c.json({
		users,
	});
});

export default route;
