import { users } from "../db/schema";
import type { Database } from "../db";

export async function getUsers(db: Database) {
	return db
		.select({
			id: users.id,
			email: users.email,
			displayName: users.displayName,
			emailVerifiedAt: users.emailVerifiedAt,
			isAdmin: users.isAdmin,
			disabledAt: users.disabledAt,
			createdAt: users.createdAt,
			updatedAt: users.updatedAt,
			profileImageKey: users.profileImageKey,
		})
		.from(users);
}