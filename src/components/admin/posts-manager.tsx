"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { batchUpdatePosts, deletePost, purgePost, restorePost } from "@/app/admin/actions";
import { DeleteButton } from "@/app/admin/delete-button";
import { CategorySelect } from "./category-select";

type PostRow = {
  id: string;
  title: string;
  status: string;
  slug: string;
  categoryName: string | null;
  authorName: string;
  viewCount: number;
  commentCount: number;
  isPinned: boolean;
  categoryPinned?: boolean;
  hasPassword?: boolean;
  externalUrl?: string | null;
  updatedAtLabel: string;
  publishedAtLabel: string | null;
  deletedAtLabel: string | null;
};

type Params = {
  status: string;
  q: string;
  category: string;
  sort: string;
  per: string;
  page: string;
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  SCHEDULED: "定时",
};
const STATUS_BADGE: Record<string, string> = {
  DRAFT: "badge",
  PUBLISHED: "badge badge-success",
  SCHEDULED: "badge badge-warning",
};

// 组 query：保留现有筛选，仅覆盖 patch 里的项；空值和默认排序不写进 URL
function buildQuery(p: Params, patch: Record<string, string | undefined>) {
  const merged = { ...p, ...patch };
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v && v !== "" && !(k === "sort" && v === "latest")) sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `/admin/posts?${s}` : "/admin/posts";
}

export function PostsManager({
  posts,
  total,
  totalPages,
  counts,
  categories,
  canEdit,
  isTrash = false,
  params,
}: {
  posts: PostRow[];
  total: number;
  totalPages: number;
  counts: Record<string, number>;
  categories: { id: string; name: string; depth: number }[];
  canEdit: boolean;
  isTrash?: boolean;
  params: Params;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveCid, setMoveCid] = useState("");
  const [pending, startTransition] = useTransition();
  const selectAllRef = useRef<HTMLInputElement>(null);

  const pageIds = useMemo(() => posts.map((p) => p.id), [posts]);
  const allChecked = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someChecked = pageIds.some((id) => selected.has(id));
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someChecked && !allChecked;
    }
  }, [someChecked, allChecked]);

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) for (const id of pageIds) next.delete(id);
      else for (const id of pageIds) next.add(id);
      return next;
    });
  }

  function runBatch(op: "publish" | "draft" | "pin" | "unpin" | "delete" | "move" | "restore" | "purge") {
    if (op === "delete" && !window.confirm(`确定将选中的 ${selected.size} 篇文章移入回收站？可在回收站恢复。`)) return;
    if (op === "purge" && !window.confirm(`确定彻底删除选中的 ${selected.size} 篇文章？此操作不可恢复！`)) return;
    if (op === "move" && !moveCid) {
      window.alert("请先选择要移动到的分类");
      return;
    }
    const ids = [...selected];
    startTransition(async () => {
      try {
        await batchUpdatePosts(ids, op, op === "move" ? moveCid : undefined);
        setSelected(new Set());
        setMoveCid("");
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  // 单篇恢复（回收站内）
  function runSingle(op: "restore", post: PostRow) {
    startTransition(async () => {
      try {
        await restorePost(BigInt(post.id));
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  const tabs = [
    { key: "", label: "全部" },
    { key: "PUBLISHED", label: `已发布 (${counts.PUBLISHED})` },
    { key: "DRAFT", label: `草稿 (${counts.DRAFT})` },
    { key: "SCHEDULED", label: `定时 (${counts.SCHEDULED})` },
    { key: "trash", label: `回收站 (${counts.TRASH ?? 0})` },
  ];

  return (
    <div className="space-y-4">
      {/* 筛选栏：状态 / 分类 / 排序 / 搜索 / 每页条数 */}
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={buildQuery(params, { status: t.key, page: undefined })}
            className={
              (params.status ?? "") === t.key
                ? "btn btn-primary !py-1.5 !text-xs"
                : "btn btn-outline !py-1.5 !text-xs"
            }
          >
            {t.label}
          </Link>
        ))}

        <CategorySelect
          size="sm"
          value={params.category}
          onChange={(v) =>
            router.push(buildQuery(params, { category: v || undefined, page: undefined }))
          }
          categories={categories}
          topOptions={[
            { value: "", label: "全部分类" },
            { value: "none", label: "未分类" },
          ]}
          placeholder="全部分类"
        />

        <select
          value={params.sort}
          onChange={(e) =>
            router.push(buildQuery(params, { sort: e.target.value, page: undefined }))
          }
          className="input !h-auto !w-auto !py-1.5 !text-xs"
        >
          <option value="latest">最新发布</option>
          <option value="updated">最近更新</option>
          <option value="pinned">置顶优先</option>
          <option value="views">浏览最多</option>
          <option value="comments">评论最多</option>
        </select>

        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = String(new FormData(e.currentTarget).get("q") ?? "").trim();
            router.push(buildQuery(params, { q: v || undefined, page: undefined }));
          }}
        >
          <input
            name="q"
            defaultValue={params.q}
            placeholder="搜索标题或内容…"
            className="input !h-auto !w-44 !py-1.5 !text-xs"
          />
          <button type="submit" className="btn btn-outline !py-1.5 !text-xs">
            搜索
          </button>
        </form>

        <select
          value={params.per}
          onChange={(e) => {
            const v = e.target.value;
            document.cookie = `admin_posts_per_page=${v}; path=/; max-age=31536000`;
            router.push(buildQuery(params, { per: v, page: undefined }));
          }}
          className="input ml-auto !h-auto !w-auto !py-1.5 !text-xs"
        >
          <option value="10">10 条/页</option>
          <option value="20">20 条/页</option>
          <option value="50">50 条/页</option>
        </select>
      </div>

      {/* 批量操作栏 */}
      {selected.size > 0 && canEdit && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/40 bg-accent-soft px-4 py-2.5">
          <span className="text-xs text-muted">
            已选 <b className="text-accent">{selected.size}</b> 篇
          </span>
          {isTrash ? (
            <>
              <button
                className="btn btn-outline !px-2.5 !py-1 !text-xs"
                disabled={pending}
                onClick={() => runBatch("restore")}
              >
                <RotateCcw size={13} />
                恢复
              </button>
              <button
                className="btn btn-danger !px-2.5 !py-1 !text-xs"
                disabled={pending}
                onClick={() => runBatch("purge")}
              >
                <Trash2 size={13} />
                彻底删除
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn-outline !px-2.5 !py-1 !text-xs"
                disabled={pending}
                onClick={() => runBatch("publish")}
              >
                立即发布
              </button>
              <button
                className="btn btn-outline !px-2.5 !py-1 !text-xs"
                disabled={pending}
                onClick={() => runBatch("draft")}
              >
                转草稿
              </button>
              <button
                className="btn btn-outline !px-2.5 !py-1 !text-xs"
                disabled={pending}
                onClick={() => runBatch("pin")}
              >
                置顶
              </button>
              <button
                className="btn btn-outline !px-2.5 !py-1 !text-xs"
                disabled={pending}
                onClick={() => runBatch("unpin")}
              >
                取消置顶
              </button>
              <CategorySelect
                size="sm"
                value={moveCid}
                onChange={setMoveCid}
                categories={categories}
                topOptions={[{ value: "none", label: "未分类" }]}
                placeholder="移动到分类…"
              />
              <button
                className="btn btn-outline !px-2.5 !py-1 !text-xs"
                disabled={pending || !moveCid}
                onClick={() => runBatch("move")}
              >
                移动
              </button>
              <button
                className="btn btn-danger !px-2.5 !py-1 !text-xs"
                disabled={pending}
                onClick={() => runBatch("delete")}
              >
                <Trash2 size={13} />
                移入回收站
              </button>
            </>
          )}
          <button
            className="ml-auto text-xs text-muted hover:text-accent"
            onClick={() => setSelected(new Set())}
          >
            取消选择
          </button>
        </div>
      )}

      {/* 文章表格（移动端窄屏可横向滚动，避免操作列被裁切） */}
      <div className="card overflow-hidden">
        {posts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-muted">
            <FileText size={32} strokeWidth={1.5} />
            <p className="text-sm">暂无文章</p>
            {canEdit && (
              <Link href="/admin/posts/new" className="btn btn-outline !text-xs">
                去写第一篇
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="w-10 px-4 py-3">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleAll}
                      className="size-4 accent-[var(--accent)]"
                      title="全选本页"
                    />
                  </th>
                  <th className="px-2 py-3 font-medium">标题</th>
                  <th className="hidden px-2 py-3 font-medium md:table-cell">分类</th>
                  <th className="hidden px-2 py-3 font-medium lg:table-cell">作者</th>
                  <th className="hidden px-2 py-3 font-medium lg:table-cell">评论</th>
                  <th className="hidden px-2 py-3 font-medium sm:table-cell">浏览</th>
                  <th className="px-2 py-3 font-medium">更新时间</th>
                  <th className="px-4 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
            <tbody className="divide-y divide-border">
              {posts.map((p) => (
                <tr key={p.id} className={selected.has(p.id) ? "bg-accent-soft" : ""}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(p.id)) next.delete(p.id);
                          else next.add(p.id);
                          return next;
                        })
                      }
                      className="size-4 accent-[var(--accent)]"
                    />
                  </td>
                  <td className="max-w-72 px-2 py-3">
                    <Link
                      href={`/admin/posts/${p.id}/edit`}
                      className="line-clamp-1 font-medium hover:text-accent"
                      title={p.title}
                    >
                      {p.isPinned && (
                        <span className="badge badge-accent mr-1.5 !px-1 !py-0 !text-[10px]">
                          置顶
                        </span>
                      )}
                      {p.categoryPinned && (
                        <span className="badge mr-1.5 !px-1 !py-0 !text-[10px] text-accent/80">
                          分类置顶
                        </span>
                      )}
                      {p.hasPassword && (
                        <span className="mr-1.5 text-[10px]" title="需要密码访问">
                          🔒
                        </span>
                      )}
                      {p.externalUrl && (
                        <span
                          className="mr-1.5 text-[10px] text-muted"
                          title="外链文章，点击标题跳转外链"
                        >
                          ↗
                        </span>
                      )}
                      {p.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted">
                      <span className={STATUS_BADGE[p.status]}>
                        {STATUS_LABEL[p.status]}
                      </span>
                      {p.deletedAtLabel ? (
                        <span className="ml-2">删除于 {p.deletedAtLabel}</span>
                      ) : (
                        p.publishedAtLabel && (
                          <span className="ml-2">发布 {p.publishedAtLabel}</span>
                        )
                      )}
                    </p>
                  </td>
                  <td className="hidden px-2 py-3 text-muted md:table-cell">
                    {p.categoryName ?? <span className="text-xs opacity-60">未分类</span>}
                  </td>
                  <td className="hidden px-2 py-3 text-muted lg:table-cell">
                    {p.authorName}
                  </td>
                  <td className="hidden px-2 py-3 text-muted lg:table-cell">
                    {p.commentCount}
                  </td>
                  <td className="hidden px-2 py-3 text-muted sm:table-cell">
                    {p.viewCount}
                  </td>
                  <td className="px-2 py-3 text-muted">{p.updatedAtLabel}</td>
                  <td className="px-4 py-3">
                    {isTrash ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          className="btn btn-ghost !px-2.5 !py-1.5 !text-xs"
                          disabled={pending}
                          onClick={() => runSingle("restore", p)}
                          title="恢复文章"
                        >
                          <RotateCcw size={14} />
                          恢复
                        </button>
                        <DeleteButton
                          id={p.id}
                          action={purgePost}
                          confirmText={`确定彻底删除《${p.title}》？此操作不可恢复！`}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/admin/posts/${p.id}/edit`}
                          className="btn btn-ghost !px-2.5 !py-1.5 !text-xs"
                          title="编辑"
                        >
                          <Pencil size={14} />
                          编辑
                        </Link>
                        {p.status === "PUBLISHED" && (
                          <Link
                            href={`/post/${p.slug}`}
                            target="_blank"
                            className="btn btn-ghost !px-2.5 !py-1.5 !text-xs"
                          >
                            查看
                          </Link>
                        )}
                        <DeleteButton
                          id={p.id}
                          action={deletePost}
                          confirmText={`确定将《${p.title}》移入回收站？可在回收站恢复。`}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={buildQuery(params, { page: String(n) })}
              className={
                n === Number(params.page)
                  ? "btn btn-primary !h-8 !w-8 !p-0 !text-xs"
                  : "btn btn-outline !h-8 !w-8 !p-0 !text-xs"
              }
            >
              {n}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
