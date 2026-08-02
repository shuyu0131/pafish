"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      className="btn btn-ghost !p-1.5"
      title="退出登录"
      aria-label="退出登录"
    >
      <LogOut size={15} />
    </button>
  );
}
