import { eq } from "drizzle-orm";
import { Hono } from "hono";

import { createDb } from "@/db";
import { lifecycleActions, users } from "@/db/schema";
import { LIFECYCLE_ACTIONS, type LifecycleAction } from "@/lib/lifecycle/types";
import { requireAdmin } from "@/middleware/auth";

/**
 * Controls the actions allowed by the lifecycle endpoint.
 * Guard it with your life, soldier.
 */
function isLifecycleAction(value: unknown): value is LifecycleAction {
    return (
        typeof value === "string" &&
        LIFECYCLE_ACTIONS.includes(value as LifecycleAction)
    );
}

const route = new Hono<{ Bindings: Env }>();

route.post("/", requireAdmin, async (c) => {
    const userId = c.req.param("userId");

    if (!userId) {
        return c.json(
            {
                error: "user_not_found",
            },
            404,
        );
    }

    const body = await c.req.json<unknown>();

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return c.json(
            {
                error: "invalid_body",
            },
            400,
        );
    }

    const { action, executeAt } = body as {
        action?: unknown;
        executeAt?: unknown;
    };

    if (!isLifecycleAction(action)) {
        return c.json(
            {
                error: "invalid_action",
            },
            400,
        );
    }

    if (
        typeof executeAt !== "number" ||
        !Number.isFinite(executeAt) ||
        executeAt <= Date.now()
    ) {
        return c.json(
            {
                error: "invalid_execute_at",
            },
            400,
        );
    }

    const db = createDb(c.env.DB);

    const user = await db
        .select({
            id: users.id,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (!user[0]) {
        return c.json(
            {
                error: "user_not_found",
            },
            404,
        );
    }

    const now = Date.now();
    const id = crypto.randomUUID();

    await db.insert(lifecycleActions).values({
        id,
        userId,
        action,
        executeAt,
        status: "pending",
        createdAt: now,
        updatedAt: now,
    });

    try {
        await c.env.LIFECYCLE_WORKFLOW.create({
            id,
            params: {
                lifecycleActionId: id,
            },
        });
    } catch (error) {
        await db
            .delete(lifecycleActions)
            .where(eq(lifecycleActions.id, id));

        throw error;
    }

    return c.json(
        {
            id,
            userId,
            action,
            executeAt,
            status: "pending",
            createdAt: now,
            updatedAt: now,
        },
        201,
    );
});

export default route;
