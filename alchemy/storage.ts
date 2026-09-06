import * as Cloudflare from "alchemy/Cloudflare";

export const ProfileBucket = Cloudflare.R2.Bucket("ProfileBucket", {
	//	forceDestroy: true,
});
