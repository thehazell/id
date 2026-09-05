import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/toast/ToastProvider";
import Button from "@/components/ui/Button";
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

function ProfilePage() {
	const { user, refresh } = useAuth();
	const toast = useToast();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [displayName, setDisplayName] = useState("");
	const [givenName, setGivenName] = useState("");
	const [familyName, setFamilyName] = useState("");
	const [middleName, setMiddleName] = useState("");
	const [nickname, setNickname] = useState("");
	const [preferredUsername, setPreferredUsername] = useState("");
	const [profileUrl, setProfileUrl] = useState("");
	const [website, setWebsite] = useState("");
	const [gender, setGender] = useState("");
	const [birthdate, setBirthdate] = useState("");
	const [zoneinfo, setZoneinfo] = useState("");
	const [locale, setLocale] = useState("");

	const [saving, setSaving] = useState(false);
	const [avatarSaving, setAvatarSaving] = useState(false);
	const [avatarVersion, setAvatarVersion] = useState<number | null>(null);

	useEffect(() => {
		setDisplayName(user?.displayName ?? "");
		setGivenName(user?.givenName ?? "");
		setFamilyName(user?.familyName ?? "");
		setMiddleName(user?.middleName ?? "");
		setNickname(user?.nickname ?? "");
		setPreferredUsername(user?.preferredUsername ?? "");
		setProfileUrl(user?.profileUrl ?? "");
		setWebsite(user?.website ?? "");
		setGender(user?.gender ?? "");
		setBirthdate(user?.birthdate ?? "");
		setZoneinfo(user?.zoneinfo ?? "");
		setLocale(user?.locale ?? "");
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
	]);

	useEffect(() => {
		if (!user?.profileImageKey) {
			setAvatarVersion(null);
			return;
		}

		setAvatarVersion(Date.now());
	}, [user?.profileImageKey]);

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
		displayName.trim() !== (user.displayName ?? "") ||
		givenName.trim() !== (user.givenName ?? "") ||
		familyName.trim() !== (user.familyName ?? "") ||
		middleName.trim() !== (user.middleName ?? "") ||
		nickname.trim() !== (user.nickname ?? "") ||
		preferredUsername.trim() !== (user.preferredUsername ?? "") ||
		profileUrl.trim() !== (user.profileUrl ?? "") ||
		website.trim() !== (user.website ?? "") ||
		gender.trim() !== (user.gender ?? "") ||
		birthdate.trim() !== (user.birthdate ?? "") ||
		zoneinfo.trim() !== (user.zoneinfo ?? "") ||
		locale.trim() !== (user.locale ?? "");

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
				displayName: displayName.trim(),
				givenName: givenName.trim(),
				familyName: familyName.trim(),
				middleName: middleName.trim(),
				nickname: nickname.trim(),
				preferredUsername: preferredUsername.trim(),
				profileUrl: profileUrl.trim(),
				website: website.trim(),
				gender: gender.trim(),
				birthdate: birthdate.trim(),
				zoneinfo: zoneinfo.trim(),
				locale: locale.trim(),
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
										src={`${getProfileAvatarUrl()}?v=${avatarVersion ?? 0}`}
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
							<div>
								<label
									htmlFor="display-name"
									className="mb-2 block text-sm font-medium text-zinc-300"
								>
									Display name
								</label>

								<Input
									id="display-name"
									value={displayName}
									onChange={(event) => setDisplayName(event.target.value)}
									placeholder="Your name"
									autoComplete="name"
									maxLength={100}
									disabled={saving}
								/>

								<div className="mt-2 flex justify-between text-xs text-zinc-600">
									<span>This name will be shown throughout Maze ID.</span>

									<span>{displayName.length}/100</span>
								</div>
							</div>

							<div>
								<label
									htmlFor="given-name"
									className="mb-2 block text-sm font-medium text-zinc-300"
								>
									Given name
								</label>

								<Input
									id="given-name"
									value={givenName}
									onChange={(event) => setGivenName(event.target.value)}
									placeholder="First name"
									autoComplete="given-name"
									maxLength={100}
									disabled={saving}
								/>
							</div>

							<div>
								<label
									htmlFor="middle-name"
									className="mb-2 block text-sm font-medium text-zinc-300"
								>
									Middle name
								</label>

								<Input
									id="middle-name"
									value={middleName}
									onChange={(event) => setMiddleName(event.target.value)}
									placeholder="Middle name"
									autoComplete="additional-name"
									maxLength={100}
									disabled={saving}
								/>
							</div>

							<div>
								<label
									htmlFor="family-name"
									className="mb-2 block text-sm font-medium text-zinc-300"
								>
									Family name
								</label>

								<Input
									id="family-name"
									value={familyName}
									onChange={(event) => setFamilyName(event.target.value)}
									placeholder="Last name"
									autoComplete="family-name"
									maxLength={100}
									disabled={saving}
								/>
							</div>

							<div>
								<label
									htmlFor="nickname"
									className="mb-2 block text-sm font-medium text-zinc-300"
								>
									Nickname
								</label>

								<Input
									id="nickname"
									value={nickname}
									onChange={(event) => setNickname(event.target.value)}
									placeholder="Nickname"
									maxLength={100}
									disabled={saving}
								/>
							</div>

							<div>
								<label
									htmlFor="preferred-username"
									className="mb-2 block text-sm font-medium text-zinc-300"
								>
									Preferred username
								</label>

								<Input
									id="preferred-username"
									value={preferredUsername}
									onChange={(event) => setPreferredUsername(event.target.value)}
									placeholder="username"
									autoComplete="username"
									maxLength={100}
									disabled={saving}
								/>
							</div>

							<div>
								<label
									htmlFor="email"
									className="mb-2 block text-sm font-medium text-zinc-300"
								>
									Email address
								</label>

								<Input id="email" value={user.email} disabled readOnly />

								<div className="mt-2 flex items-center gap-2 text-xs">
									<span
										className={`h-1.5 w-1.5 rounded-full ${
											user.emailVerifiedAt ? "bg-emerald-400" : "bg-amber-400"
										}`}
									/>

									<span className="text-zinc-500">
										{user.emailVerifiedAt
											? "Email verified"
											: "Email not verified"}
									</span>
								</div>
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
							<div>
								<label
									htmlFor="profile-url"
									className="mb-2 block text-sm font-medium text-zinc-300"
								>
									Profile URL
								</label>

								<Input
									id="profile-url"
									type="url"
									value={profileUrl}
									onChange={(event) => setProfileUrl(event.target.value)}
									placeholder="https://example.com/profile"
									autoComplete="url"
									disabled={saving}
								/>
							</div>

							<div>
								<label
									htmlFor="website"
									className="mb-2 block text-sm font-medium text-zinc-300"
								>
									Website
								</label>

								<Input
									id="website"
									type="url"
									value={website}
									onChange={(event) => setWebsite(event.target.value)}
									placeholder="https://example.com"
									disabled={saving}
								/>
							</div>
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
							<div>
								<label
									htmlFor="gender"
									className="mb-2 block text-sm font-medium text-zinc-300"
								>
									Gender
								</label>

								<Input
									id="gender"
									value={gender}
									onChange={(event) => setGender(event.target.value)}
									placeholder="Gender"
									maxLength={100}
									disabled={saving}
								/>
							</div>

							<div>
								<label
									htmlFor="birthdate"
									className="mb-2 block text-sm font-medium text-zinc-300"
								>
									Birthdate
								</label>

								<Input
									id="birthdate"
									type="date"
									value={birthdate}
									onChange={(event) => setBirthdate(event.target.value)}
									disabled={saving}
								/>
							</div>

							<div>
								<label
									htmlFor="zoneinfo"
									className="mb-2 block text-sm font-medium text-zinc-300"
								>
									Time zone
								</label>

								<Input
									id="zoneinfo"
									value={zoneinfo}
									onChange={(event) => setZoneinfo(event.target.value)}
									placeholder="America/New_York"
									disabled={saving}
								/>
							</div>

							<div>
								<label
									htmlFor="locale"
									className="mb-2 block text-sm font-medium text-zinc-300"
								>
									Locale
								</label>

								<Input
									id="locale"
									value={locale}
									onChange={(event) => setLocale(event.target.value)}
									placeholder="en-US"
									disabled={saving}
								/>
							</div>
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
