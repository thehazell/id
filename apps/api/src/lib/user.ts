import { users } from "../db/schema";
import type { Database } from "../db";

export async function getUsers(db: Database) {
	return db
		.select({
			id: users.id,
			email: users.email,

			displayName: users.displayName,
			givenName: users.givenName,
			familyName: users.familyName,
			middleName: users.middleName,
			nickname: users.nickname,
			preferredUsername: users.preferredUsername,

			profileUrl: users.profileUrl,
			profileImageKey: users.profileImageKey,
			website: users.website,

			gender: users.gender,
			birthdate: users.birthdate,
			zoneinfo: users.zoneinfo,
			locale: users.locale,

			emailVerifiedAt: users.emailVerifiedAt,
			isAdmin: users.isAdmin,
			disabledAt: users.disabledAt,

			createdAt: users.createdAt,
			updatedAt: users.updatedAt,
		})
		.from(users);
}
