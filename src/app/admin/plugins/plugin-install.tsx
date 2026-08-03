"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { installPluginFromUrl, installPluginFromZip } from "./actions";

// 应用商店（本地安装）：上传 zip 或输入下载地址，兼容商店分发 zip 格式
export function PluginInstall() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState<"file" | "url" | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function installZip() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMessage({ ok: false, text: "请先选择 zip 文件" });
      return;
    }
    setPending("file");
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append("zip", file);
      const r = await installPluginFromZip(fd);
      setMessage({ ok: true, text: `✓ 已安装 ${r.title} v${r.version}` });
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "安装失败" });
    } finally {
      setPending(null);
    }
  }

  async function installByUrl() {
    if (!url.trim()) {
      setMessage({ ok: false, text: "请填写插件包下载地址" });
      return;
    }
    setPending("url");
    setMessage(null);
    try {
      const r = await installPluginFromUrl(url.trim());
      setMessage({ ok: true, text: `✓ 已安装 ${r.title} v${r.version}` });
      setUrl("");
      router.refresh();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "安装失败" });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">安装插件</h2>
        <span className="text-[11px] text-muted">兼容商店分发 zip 格式</span>
      </div>

      <div className="space-y-3">
        <div>
          <label className="label">上传 zip 包</label>
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".zip"
              className="input min-w-0 flex-1 !py-1.5 text-xs"
            />
            <button
              type="button"
              className="btn btn-primary !px-4 !py-2 !text-xs"
              onClick={installZip}
              disabled={pending !== null}
            >
              {pending === "file" ? "安装中…" : "上传安装"}
            </button>
          </div>
        </div>

        <div>
          <label className="label">从 URL 下载安装</label>
          <div className="flex gap-2">
            <input
              type="url"
              className="input min-w-0 flex-1 font-mono !text-xs"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/plugins/demo.zip"
              disabled={pending !== null}
            />
            <button
              type="button"
              className="btn btn-outline !px-4 !py-2 !text-xs"
              onClick={installByUrl}
              disabled={pending !== null}
            >
              {pending === "url" ? "下载中…" : "下载安装"}
            </button>
          </div>
        </div>

        {message && (
          <p className={message.ok ? "text-sm text-accent" : "text-sm text-danger"}>
            {message.text}
          </p>
        )}

        <p className="text-xs text-muted">
          结构约定：zip 顶层目录为插件名（plugin.json + index.mjs）。安装前会校验目录名与路径安全，
          非法包将被拒绝。
        </p>
      </div>
    </div>
  );
}
