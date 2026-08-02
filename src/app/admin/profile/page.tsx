import { UserCircle } from "lucide-react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { avatarSrc } from "@/lib/avatar";
import { updateProfile, changePassword } from "../actions";
import { ProfileForm } from "./profile-form";
import { PasswordForm } from "./password-form";

export const metadata = { title: "个人资料" };

export default async function ProfilePage() {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: BigInt(session.id) },
    select: {
      username: true,
      nickname: true,
      email: true,
      avatarUrl: true,
      role: true,
    },
  });
  if (!user) redirect("/login");

  const avatar = avatarSrc(user.avatarUrl, user.email, 96);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">个人资料</h1>
        <p className="mt-1 text-sm text-muted">头像、昵称与密码设置</p>
      </div>

      <ProfileForm
        initial={{
          username: user.username,
          nickname: user.nickname ?? "",
          email: user.email,
          avatarUrl: user.avatarUrl ?? "",
        }}
        avatarPreview={avatar}
        onSubmit={updateProfile}
      />

      <PasswordForm onSubmit={changePassword} />
    </div>
  );
}
