"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ImagePlus } from "lucide-react";

interface ProfileFormProps {
  initial: {
    username: string;
    nickname: string;
    email: string;
    avatarUrl: string;
  };
  avatarPreview: string;
  onSubmit: (data: {
    nickname: string;
    username: string;
    email: string;
    avatarUrl: string;
  }) => Promise<unknown>;
}

export function ProfileForm({ initial, avatarPreview, onSubmit }: ProfileFormProps) {
  const router = useRouter();
  const [nickname, setNickname] = useState(initial.nickname);
  const [username, setUsername] = useState(initial.username);
  const [email, setEmail] = useState(initial.email);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [preview, setPreview] = useState(avatarPreview);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);

  // 上传头像（复用 /api/upload），成功后回填地址
  async function uploadAvatar(file: File) {
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "上传失败");
      }
      setAvatarUrl(data.url);
      setPreview(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    setPending(true);
    try {
      await onSubmit({ nickname, username, email, avatarUrl });
      setOk("已保存");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-5 p-5 sm:p-6">
      <div>
        <h2 className="text-sm font-medium">头像</h2>
        <p className="mt-0.5 text-xs text-muted">支持上传图片或填写图片地址（留空则按邮箱显示默认头像）</p>
        <div className="mt-3 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="头像预览"
            width={72}
            height={72}
            className="h-[72px] w-[72px] rounded-full border border-border object-cover"
          />
          <div className="flex flex-col gap-2">
            <label className="btn btn-outline cursor-pointer !justify-start">
              <ImagePlus size={15} />
              {uploading ? "上传中…" : "上传新头像"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadAvatar(f);
                  e.target.value = "";
                }}
              />
            </label>
            <input
              className="input !py-1.5 text-xs"
              value={avatarUrl}
              onChange={(e) => {
                setAvatarUrl(e.target.value);
                if (e.target.value.trim()) setPreview(e.target.value.trim());
              }}
              placeholder="或粘贴图片地址（/uploads/… 或 https://…）"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">显示昵称</label>
          <input
            className="input"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="留空则显示用户名"
            maxLength={50}
          />
          <p className="mt-1 text-xs text-muted">显示在后台和评论中，留空用用户名</p>
        </div>
        <div>
          <label className="label">用户名（登录名）</label>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <p className="mt-1 text-xs text-muted">2-50 位，仅限中文、字母、数字、下划线和连字符</p>
        </div>
        <div className="sm:col-span-2">
          <label className="label">邮箱</label>
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <p className="mt-1 text-xs text-muted">用于找回密码与接收评论通知</p>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {ok && <p className="text-sm text-accent">{ok}</p>}

      <div className="flex justify-end">
        <button type="submit" className="btn btn-primary" disabled={pending || uploading}>
          {pending ? "保存中…" : "保存资料"}
        </button>
      </div>
    </form>
  );
}
