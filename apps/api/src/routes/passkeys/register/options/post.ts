import { generateRegistrationOptions } from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { getCookie } from "hono/cookie";

import { createDb } from "@/db";
import { passkeys } from "@/db/schema";
import { createChallenge } from "@/lib/passkey";
import { getSessionUser } from "@/lib/session";

const route = new Hono<{ Bindings: Env }>();

route.post("/", async (c) => {
    const token = getCookie(c, "session");

    if (!token) {
        return c.json(
            {
                error: "Unauthorized",
            },
            401,
        );
    }

    const db = createDb(c.env.DB);
    const user = await getSessionUser(db, token);

    if (!user) {
        return c.json(
            {
                error: "Unauthorized",
            },
            401,
        );
    }

    const existingPasskeys = await db
        .select({
            credentialId: passkeys.credentialId,
        })
        .from(passkeys)
        .where(eq(passkeys.userId, user.id));

    const options = await generateRegistrationOptions({
        rpName: c.env.RP_NAME,
        rpID: c.env.RP_ID,
        userName: user.email,
        userDisplayName: user.email,
        excludeCredentials: existingPasskeys.map(
            ({ credentialId }) => ({
                id: credentialId,
            }),
        ),
        authenticatorSelection: {
            residentKey: "required",
            userVerification: "preferred",
        },
        attestationType: "none",
    });

    await createChallenge(
        db,
        user.id,
        options.challenge,
    );

    return c.json(options);
});

export default route;
