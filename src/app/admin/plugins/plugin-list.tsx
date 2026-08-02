"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { PluginManifest } from "@/lib/plugin-loader";
import { activatePlugin, deactivatePlugin, uninstallPlugin } from "./actions";

interface PluginItem {
  name: string;
  manifest: PluginManifest | null;
  error?: string;
  active: boolean;
  dataJson: string;
}

export function PluginList({ plugins, canEdit }: { plugins: PluginItem[]; canEdit: boolean }) {
  const router = useRouter();
  const [pendingName, setPendingName] = useState("");
  const [error, setError] = useState("");

  async function run(fn: () => Promise<unknown>, name: string) {
    setError("");
    setPendingName(name);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setPendingName("");
    }
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-danger">{error}</p>}
      {plugins.map((p) => (
        <div key={p.name} className="card space-y-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{p.manifest?.title ?? p.name}</span>
                {p.active ? (
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent">
                    已启用
                  </span>
                ) : (
                  <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[11px] text-muted">
                    未启用
                  </span>
                )}
                {p.manifest && (
                  <span className="text-xs text-muted">v{p.manifest.version}</span>
                )}
                {p.manifest?.storage ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                    云存储后端
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted">
                {p.manifest?.description ?? p.error ?? "（缺少有效 plugin.json）"}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {p.manifest?.author ? `作者：${p.manifest.author}` : ""}
                {p.manifest?.injects?.length
                  ? `　注入：${p.manifest.injects.join(" / ")}`
                  : ""}
                {p.manifest?.settings?.length
                  ? `　设置项：${p.manifest.settings.length}`
                  : ""}
              </p>
            </div>

            {canEdit && (
              <div className="flex flex-wrap items-center gap-2">
                {p.manifest?.settings?.length ? (
                  <Link href={`/admin/plugins/${p.name}`} className="btn btn-outline !px-3 !py-1.5 !text-xs">
                    设置
                  </Link>
                ) : null}
                {p.active ? (
                  <button
                    className="btn btn-outline !px-3 !py-1.5 !text-xs"
                    onClick={() => run(() => deactivatePlugin(p.name), p.name)}
                    disabled={pendingName === p.name}
                  >
                    {pendingName === p.name ? "处理中…" : "停用"}
                  </button>
                ) : (
                  <button
                    className="btn btn-primary !px-3 !py-1.5 !text-xs"
                    onClick={() => run(() => activatePlugin(p.name), p.name)}
                    disabled={pendingName === p.name}
                  >
                    {pendingName === p.name ? "处理中…" : "启用"}
                  </button>
                )}
                <button
                  className="btn btn-outline !px-3 !py-1.5 !text-xs !text-danger"
                  onClick={() => {
                    if (
                      window.confirm(`确定卸载插件“${p.manifest?.title ?? p.name}”吗？\n将删除插件目录与数据，不可恢复。`)
                    ) {
                      run(() => uninstallPlugin(p.name), p.name);
                    }
                  }}
                  disabled={pendingName === p.name}
                >
                  卸载
                </button>
              </div>
            )}
          </div>

          {p.dataJson !== "{}" && (
            <details className="group">
              <summary className="cursor-pointer text-xs text-muted hover:text-accent">
                查看插件数据（事件日志等）
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-muted/40 p-3 text-[11px] leading-relaxed text-muted">
                {p.dataJson}
              </pre>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}
