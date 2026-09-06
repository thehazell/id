import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/toast/ToastProvider";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import {
	deleteProfileAvatar,
	getProfileAvatarUrl,
	updateProfile,
	uploadProfileAvatar,
} from "@/lib/api";

export const Route = createFileRoute("/_dashboard/account/profile")({
	staticData: {
		navigation: {
			label: "Profile",
			order: 1,
		},
	},
	component: ProfilePage,
});

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type ProfileForm = {
	displayName: string;
	givenName: string;
	familyName: string;
	middleName: string;
	nickname: string;
	preferredUsername: string;
	profileUrl: string;
	website: string;
	gender: string;
	birthdate: string;
	zoneinfo: string;
	locale: string;
};

const EMPTY_PROFILE: ProfileForm = {
	displayName: "",
	givenName: "",
	familyName: "",
	middleName: "",
	nickname: "",
	preferredUsername: "",
	profileUrl: "",
	website: "",
	gender: "",
	birthdate: "",
	zoneinfo: "",
	locale: "",
};

function ProfilePage() {
	const { user, refresh } = useAuth();
	const toast = useToast();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [form, setForm] = useState<ProfileForm>(EMPTY_PROFILE);
	const [saving, setSaving] = useState(false);
	const [avatarSaving, setAvatarSaving] = useState(false);

	useEffect(() => {
		if (!user) {
			return;
		}

		setForm({
			displayName: user.displayName ?? "",
			givenName: user.givenName ?? "",
			familyName: user.familyName ?? "",
			middleName: user.middleName ?? "",
			nickname: user.nickname ?? "",
			preferredUsername: user.preferredUsername ?? "",
			profileUrl: user.profileUrl ?? "",
			website: user.website ?? "",
			gender: user.gender ?? "",
			birthdate: user.birthdate ?? "",
			zoneinfo: user.zoneinfo ?? "",
			locale: user.locale ?? "",
		});
	}, [
		user?.displayName,
		user?.givenName,
		user?.familyName,
		user?.middleName,
		user?.nickname,
		user?.preferredUsername,
		user?.profileUrl,
		user?.website,
		user?.gender,
		user?.birthdate,
		user?.zoneinfo,
		user?.locale,
		user
	]);

	const initials = useMemo(() => {
		if (!user) {
			return "?";
		}

		const name = user.displayName?.trim();

		if (name) {
			return name
				.split(/\s+/)
				.slice(0, 2)
				.map((part) => part[0])
				.join("")
				.toUpperCase();
		}

		return user.email[0]?.toUpperCase() ?? "?";
	}, [user]);

	if (!user) {
		return (
			<div className="flex justify-center py-16">
				<Spinner size="lg" />
			</div>
		);
	}

	const isDirty =
		form.displayName.trim() !== (user.displayName ?? "") ||
		form.givenName.trim() !== (user.givenName ?? "") ||
		form.familyName.trim() !== (user.familyName ?? "") ||
		form.middleName.trim() !== (user.middleName ?? "") ||
		form.nickname.trim() !== (user.nickname ?? "") ||
		form.preferredUsername.trim() !== (user.preferredUsername ?? "") ||
		form.profileUrl.trim() !== (user.profileUrl ?? "") ||
		form.website.trim() !== (user.website ?? "") ||
		form.gender.trim() !== (user.gender ?? "") ||
		form.birthdate.trim() !== (user.birthdate ?? "") ||
		form.zoneinfo.trim() !== (user.zoneinfo ?? "") ||
		form.locale.trim() !== (user.locale ?? "");

	function setField<K extends keyof ProfileForm>(
		field: K,
		value: ProfileForm[K],
	) {
		setForm((current) => ({
			...current,
			[field]: value,
		}));
	}

	function openFilePicker() {
		fileInputRef.current?.click();
	}

	async function handleAvatarChange(
		event: Parameters<
			NonNullable<React.ComponentProps<"input">["onChange"]>
		>[0],
	) {
		const file = event.target.files?.[0];
		event.target.value = "";

		if (!file) {
			return;
		}

		if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
			toast.error("Profile picture must be a JPEG, PNG, or WebP image.");
			return;
		}

		if (file.size > MAX_AVATAR_SIZE) {
			toast.error("Profile picture must be 5 MB or smaller.");
			return;
		}

		setAvatarSaving(true);

		try {
			await uploadProfileAvatar(file);
			await refresh();

			toast.success("Profile picture updated.");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Unable to update your profile picture.",
			);
		} finally {
			setAvatarSaving(false);
		}
	}

	async function handleRemoveAvatar() {
		setAvatarSaving(true);

		try {
			await deleteProfileAvatar();
			await refresh();

			toast.success("Profile picture removed.");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Unable to remove your profile picture.",
			);
		} finally {
			setAvatarSaving(false);
		}
	}

	async function handleSubmit(
		event: Parameters<NonNullable<React.ComponentProps<"form">["onSubmit"]>>[0],
	) {
		event.preventDefault();

		if (!isDirty) {
			return;
		}

		setSaving(true);

		try {
			await updateProfile({
				displayName: form.displayName.trim(),
				givenName: form.givenName.trim(),
				familyName: form.familyName.trim(),
				middleName: form.middleName.trim(),
				nickname: form.nickname.trim(),
				preferredUsername: form.preferredUsername.trim(),
				profileUrl: form.profileUrl.trim(),
				website: form.website.trim(),
				gender: form.gender.trim(),
				birthdate: form.birthdate.trim(),
				zoneinfo: form.zoneinfo.trim(),
				locale: form.locale.trim(),
			});

			await refresh();

			toast.success("Profile updated.");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Unable to update your profile.",
			);
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="max-w-2xl">
			<div className="mb-8">
				<h1 className="text-3xl font-semibold tracking-[-0.04em] text-white">
					Profile
				</h1>
				<p className="mt-2 text-sm leading-6 text-zinc-500">
					Manage your personal account information.
				</p>
			</div>

			<div className="rounded-2xl border border-white/10 bg-white/2">
				{/* Profile header */}
				<div className="border-b border-white/8 px-6 py-6">
					<div className="flex items-center gap-4">
						<div className="relative shrink-0">
							<div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-zinc-900 text-lg font-semibold text-zinc-300 ring-1 ring-violet-400/10">
								{user.profileImageKey ? (
									<img
										src={`${getProfileAvatarUrl()}?v=${encodeURIComponent(user.profileImageKey)}`}
										alt=""
										className="h-full w-full object-cover"
									/>
								) : (
									initials
								)}
							</div>
						</div>

						<div className="min-w-0 flex-1">
							<h2 className="truncate text-base font-medium text-white">
								{user.displayName || "Unnamed account"}
							</h2>

							<p className="mt-1 truncate text-sm text-zinc-500">
								{user.email}
							</p>

							<div className="mt-3 flex items-center gap-2">
								<Button
									type="button"
									variant="secondary"
									onClick={openFilePicker}
									disabled={avatarSaving}
								>
									{avatarSaving ? "Uploading..." : "Change photo"}
								</Button>

								{user.profileImageKey && (
									<Button
										type="button"
										variant="ghost"
										onClick={() => void handleRemoveAvatar()}
										disabled={avatarSaving}
									>
										Remove
									</Button>
								)}
							</div>

							<input
								ref={fileInputRef}
								type="file"
								accept="image/jpeg,image/png,image/webp"
								onChange={handleAvatarChange}
								className="hidden"
							/>

							<p className="mt-2 text-xs text-zinc-600">
								JPEG, PNG, or WebP. Maximum 5 MB.
							</p>
						</div>
					</div>
				</div>

				<form onSubmit={handleSubmit}>
					{/* Personal information */}
					<div className="px-6 py-6">
						<div className="mb-6">
							<h2 className="text-sm font-medium text-white">
								Personal information
							</h2>

							<p className="mt-1 text-sm leading-6 text-zinc-500">
								Update the information associated with your account.
							</p>
						</div>

						<div className="space-y-5">
							<Field
								id="display-name"
								label="Display name"
								value={form.displayName}
								onChange={(value) => setField("displayName", value)}
								autoComplete="name"
								disabled={saving}
							/>

							<Field
								id="given-name"
								label="Given name"
								value={form.givenName}
								onChange={(value) => setField("givenName", value)}
								autoComplete="given-name"
								disabled={saving}
							/>

							<Field
								id="middle-name"
								label="Middle name"
								value={form.middleName}
								onChange={(value) => setField("middleName", value)}
								autoComplete="additional-name"
								disabled={saving}
							/>

							<Field
								id="family-name"
								label="Family name"
								value={form.familyName}
								onChange={(value) => setField("familyName", value)}
								autoComplete="family-name"
								disabled={saving}
							/>

							<Field
								id="nickname"
								label="Nickname"
								value={form.nickname}
								onChange={(value) => setField("nickname", value)}
								autoComplete="nickname"
								disabled={saving}
							/>

							<Field
								id="preferred-username"
								label="Preferred username"
								value={form.preferredUsername}
								onChange={(value) => setField("preferredUsername", value)}
								autoComplete="username"
								disabled={saving}
							/>

							<div>
								<label
									htmlFor="email"
									className="mb-2 block text-sm font-medium text-zinc-300"
								>
									Email address
								</label>

								<div className="relative">
									<Input
										id="email"
										type="email"
										value={user.email}
										disabled
										readOnly
									/>

									<div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
										<span
											className={`h-2 w-2 rounded-full ${
												user.emailVerifiedAt ? "bg-emerald-400" : "bg-amber-400"
											}`}
										/>
									</div>
								</div>

								<p className="mt-2 text-xs text-zinc-600">
									{user.emailVerifiedAt
										? "Your email address is verified."
										: "Your email address is not verified."}
								</p>
							</div>
						</div>
					</div>

					{/* Profile */}
					<div className="border-t border-white/8 px-6 py-6">
						<div className="mb-6">
							<h2 className="text-sm font-medium text-white">Profile</h2>

							<p className="mt-1 text-sm leading-6 text-zinc-500">
								Add links to your public profile and website.
							</p>
						</div>

						<div className="space-y-5">
							<Field
								id="profile-url"
								label="Profile URL"
								value={form.profileUrl}
								onChange={(value) => setField("profileUrl", value)}
								type="url"
								autoComplete="url"
								placeholder="https://example.com/profile"
								disabled={saving}
							/>

							<Field
								id="website"
								label="Website"
								value={form.website}
								onChange={(value) => setField("website", value)}
								type="url"
								placeholder="https://example.com"
								disabled={saving}
							/>
						</div>
					</div>

					{/* Additional information */}
					<div className="border-t border-white/8 px-6 py-6">
						<div className="mb-6">
							<h2 className="text-sm font-medium text-white">
								Additional information
							</h2>

							<p className="mt-1 text-sm leading-6 text-zinc-500">
								Optional information that can be shared with applications when
								authorized.
							</p>
						</div>

						<div className="space-y-5">
							<Field
								id="gender"
								label="Gender"
								value={form.gender}
								onChange={(value) => setField("gender", value)}
								disabled={saving}
							/>

							<Field
								id="birthdate"
								label="Birthdate"
								value={form.birthdate}
								onChange={(value) => setField("birthdate", value)}
								type="date"
								disabled={saving}
							/>

							<Field
								id="zoneinfo"
								label="Time zone"
								value={form.zoneinfo}
								onChange={(value) => setField("zoneinfo", value)}
								placeholder="America/New_York"
								disabled={saving}
							/>

							<Field
								id="locale"
								label="Locale"
								value={form.locale}
								onChange={(value) => setField("locale", value)}
								placeholder="en-US"
								disabled={saving}
							/>
						</div>
					</div>

					{/* Account */}
					<div className="border-t border-white/8 px-6 py-6">
						<div className="flex items-center justify-between gap-6">
							<div>
								<h2 className="text-sm font-medium text-white">Account</h2>

								<p className="mt-1 text-sm text-zinc-500">
									Created on{" "}
									{new Date(user.createdAt).toLocaleDateString(undefined, {
										month: "long",
										day: "numeric",
										year: "numeric",
									})}
								</p>
							</div>

							{user.isAdmin && (
								<span className="shrink-0 rounded-full border border-violet-400/20 bg-violet-400/10 px-2.5 py-1 text-xs font-medium text-violet-300">
									Administrator
								</span>
							)}
						</div>
					</div>

					{/* Save bar */}
					<div className="flex items-center justify-between gap-6 border-t border-white/8 bg-white/1.5 px-6 py-4">
						<p className="text-xs text-zinc-600">
							{isDirty
								? "You have unsaved changes."
								: "Your profile is up to date."}
						</p>

						<Button type="submit" disabled={!isDirty || saving}>
							{saving ? "Saving..." : "Save changes"}
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
}
