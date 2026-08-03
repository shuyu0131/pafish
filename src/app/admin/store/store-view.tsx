"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, RefreshCw, Check, Package } from "lucide-react";
import { installFromStoreAction, updateFromStoreAction } from "./actions";

interface StoreEntry {
  name: string;
  title: string;
  version: string;
  description?: string;
  author?: string;
  zip: string;
  preview?: string;
  installed: boolean;
  localVersion: string | null;
  updateAvailable: boolean;
}

export function StoreView({
  themeItems,
  pluginItems,
  themeError,
  pluginError,
  base,
  canEdit,
}: {
  themeItems: StoreEntry[];
  pluginItems: StoreEntry[];
  themeError?: string;
  pluginError?: string;
  base: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"theme" | "plugin">("theme");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");

  async function run(fn: () => Promise<unknown>, id: string) {
    setError("");
    setPending(id);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setPending("");
    }
  }

  const items = tab === "theme" ? themeItems : pluginItems;
  const catError = tab === "theme" ? themeError : pluginError;

  function previewSrc(p: string | undefined) {
    if (!p) return null;
    if (/^https?:\/\//i.test(p)) return p;
    return base ? `${base}${p.startsWith("/") ? p : `/${p}`}` : p;
  }

  return (
    <div className="space-y-4">
      {/* Tab 切换 */}
      <div className="flex gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setTab("theme")}
          className={`border-b-2 px-4 py-2 text-sm transition-colors ${
            tab === "theme"
              ? "border-accent font-medium text-foreground"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          主题市场（{themeItems.length}）
        </button>
        <button
          type="button"
          onClick={() => setTab("plugin")}
          className={`border-b-2 px-4 py-2 text-sm transition-colors ${
            tab === "plugin"
              ? "border-accent font-medium text-foreground"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          插件市场（{pluginItems.length}）
        </button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {catError && (
        <div className="card p-4 text-sm text-danger">
          {catError}
          <span className="text-muted">　可在“站点设置 → 应用商店地址”检查源配置。</span>
        </div>
      )}

      {items.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">
          {catError ? "目录不可用" : "商店中暂时没有条目"}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => {
            const id = `${tab}:${it.name}`;
            const busy = pending === id;
            const preview = previewSrc(it.preview);
            return (
              <div key={it.name} className="card overflow-hidden">
                {/* 预览图 / 占位 */}
                <div className="flex h-32 items-center justify-center bg-muted/20">
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={preview}
                      alt={`${it.title} 预览`}
                      loading="lazy"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <span className="flex flex-col items-center gap-1.5 text-muted">
                      <Package size={26} />
                      <span className="text-[11px]">暂无预览图</span>
                    </span>
                  )}
                </div>

                <div className="space-y-2.5 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{it.title}</span>
                    <span className="rounded bg-muted/40 px-1.5 py-0.5 text-[11px] text-muted">
                      v{it.version}
                    </span>
                    {it.installed && (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent">
                        {it.updateAvailable
                          ? `已装 v${it.localVersion}，有新版本`
                          : "已安装"}
                      </span>
                    )}
                  </div>
                  {it.author && <p className="text-xs text-muted">作者：{it.author}</p>}
                  {it.description && (
                    <p className="text-sm leading-relaxed text-muted">{it.description}</p>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    {canEdit ? (
                      it.installed && !it.updateAvailable ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent">
                          <Check size={14} />
                          已安装
                        </span>
                      ) : (
                        <button
                          className="btn btn-primary !px-3 !py-1.5 !text-xs"
                          disabled={busy}
                          onClick={() =>
                            run(
                              it.updateAvailable
                                ? () => updateFromStoreAction(tab, it.name)
                                : () => installFromStoreAction(tab, it.name),
                              id
                            )
                          }
                        >
                          {busy ? (
                            "处理中…"
                          ) : it.updateAvailable ? (
                            <>
                              <RefreshCw size={13} />
                              更新到 v{it.version}
                            </>
                          ) : (
                            <>
                              <Download size={13} />
                              安装
                            </>
                          )}
                        </button>
                      )
                    ) : (
                      <span className="text-xs text-muted">仅管理员可安装</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
