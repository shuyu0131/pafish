"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { ThemeManifest } from "@/lib/theme";
import { activateTheme, uninstallTheme } from "./actions";

interface ThemeItem {
  name: string;
  manifest: ThemeManifest | null;
  error?: string;
  current: boolean;
  settingsCount: number;
}

export function ThemeList({ themes, canEdit }: { themes: ThemeItem[]; canEdit: boolean }) {
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
      {themes.map((t) => (
        <div key={t.name} className="card space-y-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{t.manifest?.title ?? t.name}</span>
                {t.current ? (
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent">
                    当前主题
                  </span>
                ) : null}
                {t.manifest && <span className="text-xs text-muted">v{t.manifest.version}</span>}
              </div>
              <p className="mt-1 text-sm text-muted">
                {t.manifest?.description ?? t.error ?? "（缺少有效 theme.json）"}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {t.manifest?.author ? `作者：${t.manifest.author}` : ""}
                {t.manifest && (
                  <span>　目录：<code className="rounded bg-muted/40 px-1 py-0.5">themes/{t.name}/</code></span>
                )}
                {t.manifest && t.settingsCount > 0 && (
                  <span>　设置项：{t.settingsCount}</span>
                )}
              </p>
            </div>

            {canEdit && (
              <div className="flex flex-wrap items-center gap-2">
                {t.current && t.settingsCount > 0 && (
                  <Link
                    href={`/admin/appearance/${t.name}`}
                    className="btn btn-outline !px-3 !py-1.5 !text-xs"
                  >
                    设置
                  </Link>
                )}
                {!t.current && t.settingsCount > 0 && (
                  <span className="text-xs text-muted">启用后可配置</span>
                )}
                {!t.current && (
                  <button
                    className="btn btn-primary !px-3 !py-1.5 !text-xs"
                    onClick={() => run(() => activateTheme(t.name), t.name)}
                    disabled={pendingName === t.name}
                  >
                    {pendingName === t.name ? "处理中…" : "启用"}
                  </button>
                )}
                {!t.current && (
                  <button
                    className="btn btn-outline !px-3 !py-1.5 !text-xs !text-danger"
                    onClick={() => {
                      if (
                        window.confirm(
                          `确定卸载主题“${t.manifest?.title ?? t.name}”吗？\n将删除主题目录与设置，不可恢复。`
                        )
                      ) {
                        run(() => uninstallTheme(t.name), t.name);
                      }
                    }}
                    disabled={pendingName === t.name}
                  >
                    卸载
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
