import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { Hono } from "hono";

import { createDb } from "@/db";
import { createChallenge } from "@/lib/passkey";

const route = new Hono<{ Bindings: Env }>();

route.post("/", async (c) => {
	const db = createDb(c.env.DB);

	const options = await generateAuthenticationOptions({
		rpID: c.env.RP_ID,
		userVerification: "preferred",
	});

	const challenge = await createChallenge(db, null, options.challenge);

	return c.json({
		...options,
		challengeId: challenge.id,
	});
});

export default route;
