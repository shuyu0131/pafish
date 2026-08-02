"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { regenerateApiKey, sendTestEmailAction } from "../actions";

interface SettingsFormProps {
  fields: {
    key: string;
    label: string;
    placeholder?: string;
    textarea?: boolean;
    password?: boolean;
    hint?: string;
  }[];
  initial: Record<string, string>;
  onSubmit: (data: Record<string, string>) => Promise<unknown>;
  canEdit: boolean;
}

export function SettingsForm({ fields, initial, onSubmit, canEdit }: SettingsFormProps) {
  const router = useRouter();

  // 黑名单存储为 JSON 数组，表单内以逗号分隔文本展示
  function ipListToText(list: string | undefined): string {
    try {
      const parsed = JSON.parse(list ?? "[]");
      return Array.isArray(parsed) ? parsed.join(", ") : "";
    } catch {
      return "";
    }
  }
  function textToIpList(text: string): string {
    const items = text
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return JSON.stringify([...new Set(items)]);
  }

  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const f of fields) v[f.key] = initial[f.key] ?? "";
    v.comments_enabled = initial.comments_enabled ?? "true";
    v.comments_need_review = initial.comments_need_review ?? "true";
    v.posts_per_page = initial.posts_per_page ?? "10";
    v.notify_email_enabled = initial.notify_email_enabled ?? "false";
    v.allow_registration = initial.allow_registration ?? "true";
    v.upload_max_mb = initial.upload_max_mb ?? "20";
    v.blocked_ips = ipListToText(initial.blocked_ips);
    v.api_enabled = initial.api_enabled ?? "false";
    v.api_key = initial.api_key ?? "";
    v.require_email_verify = initial.require_email_verify ?? "true";
    v.comments_captcha_enabled = initial.comments_captcha_enabled ?? "true";
    return v;
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [testMsg, setTestMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setPending(true);
    try {
      // 黑名单文本转 JSON 数组后提交
      await onSubmit({ ...values, blocked_ips: textToIpList(values.blocked_ips ?? "") });
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setPending(false);
    }
  }

  async function regenerate() {
    setError("");
    setPending(true);
    try {
      const key = await regenerateApiKey();
      setValues((v) => ({ ...v, api_key: key }));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "重新生成失败");
    } finally {
      setPending(false);
    }
  }

  // 发送测试邮件：使用当前表单填写的 SMTP 配置（未保存也能测），成功后提示收件地址
  async function testSmtp() {
    setError("");
    setTestMsg("");
    setPending(true);
    try {
      const res = await sendTestEmailAction({
        host: values.smtp_host ?? "",
        port: values.smtp_port ?? "",
        user: values.smtp_user ?? "",
        pass: values.smtp_pass ?? "",
        from: values.smtp_from ?? "",
      });
      setTestMsg(`✓ 测试邮件已发送至 ${res.to}，请查收（含垃圾箱）`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "发送失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="card space-y-4 p-6">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="label">{f.label}</label>
            {f.textarea ? (
              <textarea
                className="input min-h-32 resize-y"
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                disabled={!canEdit}
              />
            ) : (
              <input
                className="input"
                type={f.password ? "password" : "text"}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                disabled={!canEdit}
              />
            )}
            {f.hint && <p className="mt-1 text-xs text-muted">{f.hint}</p>}
          </div>
        ))}
      </div>

      <div className="card space-y-4 p-6">
        <h2 className="text-sm font-medium">评论与列表</h2>
        <div className="space-y-3">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--accent)]"
              checked={values.comments_enabled === "true"}
              onChange={(e) =>
                setValues((v) => ({ ...v, comments_enabled: e.target.checked ? "true" : "false" }))
              }
              disabled={!canEdit}
            />
            <span className="text-sm">启用评论功能</span>
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--accent)]"
              checked={values.comments_need_review === "true"}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  comments_need_review: e.target.checked ? "true" : "false",
                }))
              }
              disabled={!canEdit}
            />
            <span className="text-sm">新评论需审核后显示</span>
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--accent)]"
              checked={values.comments_captcha_enabled === "true"}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  comments_captcha_enabled: e.target.checked ? "true" : "false",
                }))
              }
              disabled={!canEdit}
            />
            <span className="text-sm">游客评论需输入图形验证码（已登录用户免验证码）</span>
          </label>
          <div>
            <label className="label">每页文章数</label>
            <input
              type="number"
              min={1}
              max={50}
              className="input !w-32"
              value={values.posts_per_page ?? "10"}
              onChange={(e) => setValues((v) => ({ ...v, posts_per_page: e.target.value }))}
              disabled={!canEdit}
            />
          </div>
          <div>
            <label className="label">IP 黑名单</label>
            <textarea
              className="input min-h-24 resize-y"
              value={values.blocked_ips ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, blocked_ips: e.target.value }))}
              placeholder="如：1.2.3.4, 5.6.7.8（逗号或换行分隔）"
              disabled={!canEdit}
            />
            <p className="mt-1 text-xs text-muted">
              拉黑后该 IP 无法再提交评论；也可在评论审核页按 IP 一键拉黑。
            </p>
          </div>
        </div>
      </div>

      <div className="card space-y-4 p-6">
        <h2 className="text-sm font-medium">上传与媒体库</h2>
        <div className="space-y-3">
          <div>
            <label className="label">上传大小限制（MB）</label>
            <input
              type="number"
              min={1}
              max={200}
              className="input !w-32"
              value={values.upload_max_mb ?? "20"}
              onChange={(e) => setValues((v) => ({ ...v, upload_max_mb: e.target.value }))}
              disabled={!canEdit}
            />
          </div>
          <p className="text-xs text-muted">
            媒体库支持图片（自动压缩）/ 文档 / 压缩包 / 音视频，单个文件大小上限即此值（1–200MB）。
            部分服务器（如 Nginx）默认限制请求体为 1MB，大文件上传前需同步调整服务器配置（如
            client_max_body_size），否则会直接失败。
          </p>
        </div>
      </div>

      <div className="card space-y-4 p-6">
        <h2 className="text-sm font-medium">账号与注册</h2>
        <div className="space-y-3">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--accent)]"
              checked={values.allow_registration === "true"}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  allow_registration: e.target.checked ? "true" : "false",
                }))
              }
              disabled={!canEdit}
            />
            <span className="text-sm">开放注册（关闭后注册页不可用）</span>
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--accent)]"
              checked={values.require_email_verify === "true"}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  require_email_verify: e.target.checked ? "true" : "false",
                }))
              }
              disabled={!canEdit}
            />
            <span className="text-sm">注册需邮箱验证码（依赖下方 SMTP 配置）</span>
          </label>
          <p className="text-xs text-muted">
            开启后访客可在 /register 自助注册，注册即登录；管理员可在“用户管理”中禁用/解禁账号。
          </p>
        </div>
      </div>

      <div className="card space-y-4 p-6">
        <h2 className="text-sm font-medium">邮件服务（SMTP）</h2>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">SMTP 主机</label>
              <input
                className="input"
                value={values.smtp_host ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, smtp_host: e.target.value }))}
                placeholder="smtp.example.com"
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className="label">端口</label>
              <input
                className="input !w-40"
                type="number"
                value={values.smtp_port ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, smtp_port: e.target.value }))}
                placeholder="465（SSL）或 587（STARTTLS）"
                disabled={!canEdit}
              />
            </div>
          </div>
          <div>
            <label className="label">账号</label>
            <input
              className="input"
              value={values.smtp_user ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, smtp_user: e.target.value }))}
              placeholder="noreply@example.com"
              disabled={!canEdit}
            />
          </div>
          <div>
            <label className="label">密码 / 授权码</label>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={values.smtp_pass ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, smtp_pass: e.target.value }))}
              placeholder="••••••••"
              disabled={!canEdit}
            />
          </div>
          <div>
            <label className="label">发件人地址（可选，默认用账号）</label>
            <input
              className="input"
              type="email"
              value={values.smtp_from ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, smtp_from: e.target.value }))}
              placeholder="noreply@example.com"
              disabled={!canEdit}
            />
          </div>
          <p className="text-xs text-muted">
            用于发送注册/找回密码验证码、评论回复提醒与站长通知；配置保存在服务器，不会出现在页面源码。
            端口 465 使用 SSL，其余端口自动尝试 STARTTLS；也可在 .env 配置 SMTP_* 作为兜底。
          </p>
          {canEdit && (
            <button
              type="button"
              className="btn btn-outline !text-xs"
              onClick={testSmtp}
              disabled={pending}
            >
              {pending ? "发送中…" : "发送测试邮件"}
            </button>
          )}
          {testMsg && <p className="text-sm text-accent">{testMsg}</p>}
        </div>
      </div>

      <div className="card space-y-4 p-6">
        <h2 className="text-sm font-medium">邮件通知（新评论提醒）</h2>
        <div className="space-y-3">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--accent)]"
              checked={values.notify_email_enabled === "true"}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  notify_email_enabled: e.target.checked ? "true" : "false",
                }))
              }
              disabled={!canEdit}
            />
            <span className="text-sm">启用邮件通知（需在上方配置 SMTP）</span>
          </label>
          <div>
            <label className="label">接收通知的邮箱</label>
            <input
              className="input"
              type="email"
              value={values.notify_email ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, notify_email: e.target.value }))}
              placeholder="admin@example.com"
              disabled={!canEdit}
            />
          </div>
          <p className="text-xs text-muted">
            新评论/新回复产生时发送提醒邮件；站内通知（后台铃铛）始终生效，无需 SMTP。
          </p>
        </div>
      </div>

      <div className="card space-y-4 p-6">
        <h2 className="text-sm font-medium">开放 API</h2>
        <div className="space-y-3">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--accent)]"
              checked={values.api_enabled === "true"}
              onChange={(e) =>
                setValues((v) => ({ ...v, api_enabled: e.target.checked ? "true" : "false" }))
              }
              disabled={!canEdit}
            />
            <span className="text-sm">启用开放 API（JSON 接口，供第三方程序调用）</span>
          </label>
          <div>
            <label className="label">API Key</label>
            <div className="flex gap-2">
              <input
                className="input min-w-0 flex-1 font-mono !text-xs"
                value={values.api_key ?? ""}
                readOnly
                placeholder="启用后自动生成"
              />
              {canEdit && (
                <button
                  type="button"
                  className="btn btn-outline !px-3 !py-2 !text-xs"
                  onClick={regenerate}
                  disabled={pending}
                >
                  重新生成
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-muted">
              调用时在请求头携带 X-API-Key；Key 泄露后请立即重新生成（旧 Key 作废）。
            </p>
          </div>
          <div>
            <label className="label">调用示例</label>
            <pre className="overflow-x-auto rounded-lg bg-muted/40 p-3 text-[11px] leading-relaxed text-muted">{`curl -H "X-API-Key: <你的Key>" https://你的域名/api/v1/posts
curl -H "X-API-Key: <你的Key>" https://你的域名/api/v1/posts/文章别名
curl -H "X-API-Key: <你的Key>" "https://你的域名/api/v1/comments?postId=1"
# 更多：/api/v1/categories、/api/v1/tags`}</pre>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {saved && <p className="text-sm text-accent">✓ 设置已保存</p>}

      {canEdit && (
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "保存中…" : "保存设置"}
        </button>
      )}
    </form>
  );
}
