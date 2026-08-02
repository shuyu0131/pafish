"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RoleSelect({
  userId,
  role,
  onUpdate,
}: {
  userId: string;
  role: string;
  onUpdate: (id: bigint, role: string) => Promise<unknown>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function change(e: React.ChangeEvent<HTMLSelectElement>) {
    setPending(true);
    try {
      await onUpdate(BigInt(userId), e.target.value);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "操作失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <select
      className="input !w-auto !py-1.5 !text-xs"
      value={role}
      onChange={change}
      disabled={pending}
    >
      <option value="ADMIN">管理员</option>
      <option value="EDITOR">编辑</option>
      <option value="USER">用户</option>
    </select>
  );
}
