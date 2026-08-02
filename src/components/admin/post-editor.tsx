"use client";

import "@uiw/react-md-editor/markdown-editor.css";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ChevronDown, ImagePlus, Library } from "lucide-react";
import type { ICommand } from "@uiw/react-md-editor";
import { createPost, updatePost } from "@/app/admin/actions";
import { slugify } from "@/lib/utils";
import { cnCommands, cnExtraCommands } from "./md-editor-config";
import { MediaPicker } from "./media-picker";
import { uploadMedia } from "./upload-image";
import { CategorySelect } from "./category-select";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[560px] items-center justify-center border border-border rounded-xl text-sm text-muted">
      编辑器加载中…
    </div>
  ),
});

interface CategoryOption {
  id: string;
  name: string;
  depth: number;
}
interface TagOption {
  id: string;
  name: string;
}

interface CustomField {
  key: string;
  value: string;
}

interface PostEditorProps {
  mode: "create" | "edit";
  postId?: string;
  initial?: {
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    coverUrl: string | null;
    categoryId: string | null;
    tagIds: string[];
    isPinned: boolean;
    status: string;
    publishedAt: string | null;
    // 高级属性
    hasPassword: boolean;
    externalUrl: string | null;
    categoryPinned: boolean;
    customFields: CustomField[];
  };
  categories: CategoryOption[];
  tags: TagOption[];
}

export function PostEditor({ mode, postId, initial, categories, tags }: PostEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!initial?.slug);
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [coverUrl, setCoverUrl] = useState(initial?.coverUrl ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [tagIds, setTagIds] = useState<string[]>(initial?.tagIds ?? []);
  const [newTagNames, setNewTagNames] = useState<string[]>([]);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [isPinned, setIsPinned] = useState(initial?.isPinned ?? false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // 高级属性
  const [password, setPassword] = useState(""); // 新密码输入（留空表示不修改）
  const [removePassword, setRemovePassword] = useState(false);
  const [externalUrl, setExternalUrl] = useState(initial?.externalUrl ?? "");
  const [categoryPinned, setCategoryPinned] = useState(initial?.categoryPinned ?? false);
  const [customFields, setCustomFields] = useState<CustomField[]>(
    initial?.customFields?.length ? initial.customFields : [{ key: "", value: "" }]
  );

  // 自动保存（编辑已有文章时每 60 秒保存一次，防丢稿）
  const [autoStatus, setAutoStatus] = useState("idle");
  const dirty =
    title !== (initial?.title ?? "") ||
    slug !== (initial?.slug ?? "") ||
    excerpt !== (initial?.excerpt ?? "") ||
    content !== (initial?.content ?? "") ||
    coverUrl !== (initial?.coverUrl ?? "") ||
    categoryId !== (initial?.categoryId ?? "") ||
    JSON.stringify(tagIds) !== JSON.stringify(initial?.tagIds ?? []) ||
    newTagNames.length > 0 ||
    categoryId === "__new__" ||
    isPinned !== (initial?.isPinned ?? false) ||
    password.trim() !== "" ||
    removePassword ||
    externalUrl !== (initial?.externalUrl ?? "") ||
    categoryPinned !== (initial?.categoryPinned ?? false) ||
    JSON.stringify(customFields) !== JSON.stringify(initial?.customFields ?? [{ key: "", value: "" }]);

  useEffect(() => {
    if (mode !== "edit" || !postId) return;
    const timer = setInterval(() => {
      if (!dirty || !title.trim() || !content.trim()) return;
      setAutoStatus("saving");
      updatePost(BigInt(postId), {
        title: title.trim(),
        slug: slug.trim() || undefined,
        excerpt,
        content,
        coverUrl: coverUrl.trim() || null,
        categoryId: categoryId && categoryId !== "__new__" ? Number(categoryId) : null,
        newCategory: categoryId === "__new__" ? newCategoryInput.trim() || null : null,
        tagIds: tagIds.map(Number),
        newTags: newTagNames,
        isPinned,
        password: password.trim() || null,
        removePassword,
        externalUrl: externalUrl.trim() || null,
        categoryPinned,
        customFields: customFields.filter((f) => f.key.trim() || f.value.trim()),
        action: "auto",
        scheduledAt: null,
      })
        .then(() => {
          setAutoStatus(
            `saved ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`
          );
        })
        .catch(() => setAutoStatus("error"));
    }, 60_000);
    return () => clearInterval(timer);
  }, [dirty, mode, postId, title, slug, excerpt, content, coverUrl, categoryId, tagIds, isPinned]);

  function onTitleChange(v: string) {
    setTitle(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  function toggleTag(id: string) {
    setTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  // 输入新标签：已存在的直接选中，不存在的加入新建列表（保存文章时创建）
  function addTag() {
    const parts = tagInput.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return;
    for (const name of parts) {
      const hit = tags.find((t) => t.name === name);
      if (hit) {
        setTagIds((prev) => (prev.includes(hit.id) ? prev : [...prev, hit.id]));
      } else {
        setNewTagNames((prev) => (prev.includes(name) ? prev : [...prev, name]));
      }
    }
    setTagInput("");
  }

  function removeNewTag(name: string) {
    setNewTagNames((prev) => prev.filter((n) => n !== name));
  }

  async function onUpload(file: File) {
    try {
      const { url } = await uploadMedia(file);
      setCoverUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败");
    }
  }

  async function submit(action: "draft" | "publish" | "schedule") {
    setError("");
    setPending(action);

    if (!title.trim()) {
      setError("请填写标题");
      setPending(null);
      return;
    }
    if (!content.trim()) {
      setError("请填写正文内容");
      setPending(null);
      return;
    }
    if (action === "schedule" && !scheduledAt) {
      setError("请选择定时发布时间");
      setPending(null);
      return;
    }

    const payload = {
      title: title.trim(),
      slug: slug.trim() || undefined,
      excerpt: excerpt.trim(),
      content,
      coverUrl: coverUrl.trim() || null,
      categoryId: categoryId && categoryId !== "__new__" ? Number(categoryId) : null,
      newCategory: categoryId === "__new__" ? newCategoryInput.trim() || null : null,
      tagIds: tagIds.map(Number),
      newTags: newTagNames,
      isPinned,
      password: password.trim() || null,
      removePassword,
      externalUrl: externalUrl.trim() || null,
      categoryPinned,
      customFields: customFields.filter((f) => f.key.trim() || f.value.trim()),
      action,
      scheduledAt: action === "schedule" ? scheduledAt : null,
    };

    try {
      if (mode === "create") {
        await createPost(payload);
      } else if (postId) {
        await updatePost(BigInt(postId), payload);
      }
      // server action 内部 redirect，不会走到这里
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setPending(null);
    }
  }

  // Ctrl+S 快捷键：快速保存草稿（发布仍需手动点击）
  const submitRef = useRef(submit);
  submitRef.current = submit;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        submitRef.current("draft");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // 插入媒体：工具栏按钮打开弹窗（本地上传 / 媒体库），选择后光标处插入
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"insert" | "cover">("insert");
  const pickApiRef = useRef<{ replaceSelection: (text: string) => unknown } | null>(null);

  const insertMediaCommand = useMemo<ICommand>(
    () => ({
      name: "insert-media",
      keyCommand: "insert-media",
      buttonProps: { "aria-label": "插入媒体", title: "插入媒体（本地上传或媒体库）" },
      icon: <ImagePlus size={14} />,
      execute: (_state, api) => {
        pickApiRef.current = api;
        setPickerMode("insert");
        setPickerOpen(true);
      },
    }),
    []
  );

  function handlePickFromPicker(url: string, mime: string, name: string) {
    setPickerOpen(false);
    if (pickerMode === "cover") {
      setCoverUrl(url);
      return;
    }
    const isImage = mime.startsWith("image/");
    const label = name.replace(/\.[^.]+$/, "") || "媒体";
    const md = isImage ? `![${label}](${url})` : `[${label}](${url})`;
    const api = pickApiRef.current;
    if (api) {
      api.replaceSelection(md);
    } else {
      setContent((c) => c + `\n\n${md}\n`);
    }
  }

  const isScheduled = initial?.status === "SCHEDULED";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      {/* 左侧：标题 + 正文 */}
      <div className="min-w-0 space-y-5">
        <input
          className="input !border-transparent !bg-transparent !px-0 !py-1 text-3xl font-semibold tracking-tight placeholder:text-muted focus:!border-transparent focus:!shadow-none"
          placeholder="文章标题"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
        />

        <div data-color-mode="light">
          <MDEditor
            value={content}
            onChange={(v) => setContent(v ?? "")}
            height={560}
            preview="edit"
            commands={[...cnCommands, insertMediaCommand]}
            extraCommands={cnExtraCommands}
            visibleDragbar={false}
            textareaProps={{ placeholder: "开始写作…（支持拖拽/粘贴图片上传）" }}
            onPaste={(e) => {
              const files = Array.from(e.clipboardData?.files ?? []);
              if (files.length > 0 && files[0].type.startsWith("image/")) {
                e.preventDefault();
                const ta = e.currentTarget as unknown as HTMLTextAreaElement;
                const start = ta.selectionStart ?? ta.value.length;
                const end = ta.selectionEnd ?? ta.value.length;
                uploadMedia(files[0])
                  .then(({ url }) => {
                    const md = `\n\n![图片](${url})\n`;
                    setContent((c) => c.slice(0, start) + md + c.slice(end));
                  })
                  .catch((err) =>
                    setError(err instanceof Error ? err.message : "上传失败")
                  );
              }
            }}
          />
        </div>
      </div>

      {/* 右侧：发布按钮 + 设置面板 */}
      <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        {/* 发布按钮区（emlog 习惯：按钮在右侧顶部） */}
        <div className="card space-y-2.5 p-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn btn-outline !w-full"
              disabled={pending !== null}
              onClick={() => submit("draft")}
            >
              {pending === "draft" ? "保存中…" : "存为草稿"}
            </button>
            <button
              type="button"
              className="btn btn-primary !w-full"
              disabled={pending !== null}
              onClick={() => submit("publish")}
            >
              {pending === "publish" ? "发布中…" : "立即发布"}
            </button>
          </div>
          <button
            type="button"
            className="btn btn-ghost !w-full"
            disabled={pending !== null}
            onClick={() => submit("schedule")}
          >
            {pending === "schedule" ? "保存中…" : "定时发布"}
          </button>
          {error && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          )}
        </div>

        {/* 自动保存状态（编辑模式） */}
        {mode === "edit" && (
          <p className="px-1 text-xs text-muted">
            {autoStatus === "saving"
              ? "自动保存中…"
              : autoStatus.startsWith("saved")
                ? `已自动保存 ${autoStatus.slice(5)}${dirty ? "（还有未保存更改）" : ""}`
                : autoStatus === "error"
                  ? "自动保存失败，请手动保存"
                  : "内容将每 60 秒自动保存，防止意外丢失"}
          </p>
        )}

        {/* 设置面板 */}
        <div className="card space-y-4 p-4">
          <div>
            <label className="label">分类</label>
            <CategorySelect
              value={categoryId}
              onChange={setCategoryId}
              categories={categories}
              topOptions={[{ value: "", label: "无分类" }]}
              allowNew
              placeholder="无分类"
            />
            {categoryId === "__new__" && (
              <input
                className="input mt-2 !text-xs"
                value={newCategoryInput}
                onChange={(e) => setNewCategoryInput(e.target.value)}
                placeholder="输入新分类名称（保存文章时创建）"
              />
            )}
          </div>

          <div>
            <label className="label">标签</label>
            {/* 已选标签（含新输入、保存时创建的） */}
            {tagIds.length + newTagNames.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {tagIds.map((id) => {
                  const t = tags.find((x) => x.id === id);
                  if (!t) return null;
                  return (
                    <span key={id} className="badge badge-accent">
                      {t.name}
                      <button
                        type="button"
                        onClick={() => toggleTag(id)}
                        className="ml-1 font-bold leading-none hover:opacity-60"
                        aria-label={`移除标签 ${t.name}`}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
                {newTagNames.map((n) => (
                  <span key={n} className="badge badge-accent">
                    {n}
                    <button
                      type="button"
                      onClick={() => removeNewTag(n)}
                      className="ml-1 font-bold leading-none hover:opacity-60"
                      aria-label={`移除标签 ${n}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            {/* 输入新标签 */}
            <input
              className="input !text-xs"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="输入标签名，回车/逗号添加"
            />
            {/* 已有标签点选 */}
            <div className="mt-2 flex flex-wrap gap-2">
              {tags.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTag(t.id)}
                  className={
                    tagIds.includes(t.id)
                      ? "badge badge-accent cursor-pointer"
                      : "badge cursor-pointer hover:border-accent"
                  }
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">封面图</label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="input min-w-0 flex-1 !text-xs"
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                placeholder="图片 URL"
              />
              <label className="btn btn-outline cursor-pointer !px-2.5 !py-2 !text-xs">
                {uploading ? "上传中…" : "上传"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUpload(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                type="button"
                className="btn btn-ghost !px-2.5 !py-2 !text-xs"
                onClick={() => {
                  setPickerMode("cover");
                  setPickerOpen(true);
                }}
                title="从媒体库选择图片"
              >
                <Library size={13} />
                媒体库
              </button>
            </div>
            {coverUrl && (
              <img
                src={coverUrl}
                alt="封面预览"
                className="mt-2 h-24 w-full rounded-lg border border-border object-cover"
              />
            )}
          </div>

          <div>
            <label className="label">摘要</label>
            <textarea
              className="input min-h-16 resize-y !text-xs"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="展示在列表页（留空自动截取）"
            />
          </div>

          {/* 高级选项（折叠）：别名 / 置顶 / 定时时间 */}
          <details className="group rounded-lg border border-border">
            <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-xs font-medium text-muted transition-colors hover:text-foreground">
              高级选项
              <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-3.5 border-t border-border p-3">
              <div>
                <label className="label !text-xs">别名（Slug）</label>
                <input
                  className="input !text-xs"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugTouched(true);
                  }}
                  placeholder="自动根据标题生成"
                />
              </div>
              <div>
                <label className="label !text-xs">定时发布时间</label>
                <input
                  type="datetime-local"
                  className="input !text-xs"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
                {isScheduled && (
                  <p className="mt-1 text-xs text-muted">当前为定时发布状态，保存时将更新时间</p>
                )}
              </div>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--accent)]"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                />
                <span className="text-xs">置顶文章（列表页优先展示）</span>
              </label>

              <div className="border-t border-border pt-3.5">
                <label className="label !text-xs">访问密码（可选）</label>
                <input
                  type="password"
                  className="input !text-xs"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={initial?.hasPassword ? "已设置密码，留空保持不变" : "设置后访客需输入密码才能阅读"}
                  autoComplete="new-password"
                />
                {initial?.hasPassword && (
                  <label className="mt-1.5 flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-[var(--accent)]"
                      checked={removePassword}
                      onChange={(e) => setRemovePassword(e.target.checked)}
                    />
                    <span className="text-xs text-muted">移除现有密码</span>
                  </label>
                )}
              </div>

              <div>
                <label className="label !text-xs">外链跳转地址（可选）</label>
                <input
                  className="input !text-xs"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://… 填写后列表标题/封面点击直接跳转外链"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--accent)]"
                  checked={categoryPinned}
                  onChange={(e) => setCategoryPinned(e.target.checked)}
                />
                <span className="text-xs">分类内置顶（在所属分类页置顶展示）</span>
              </label>

              <div>
                <label className="label !text-xs">自定义字段</label>
                <div className="space-y-2">
                  {customFields.map((f, i) => (
                    <div key={i} className="flex gap-1.5">
                      <input
                        className="input !w-2/5 !text-xs"
                        value={f.key}
                        onChange={(e) =>
                          setCustomFields((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, key: e.target.value } : x))
                          )
                        }
                        placeholder="名称"
                      />
                      <input
                        className="input min-w-0 flex-1 !text-xs"
                        value={f.value}
                        onChange={(e) =>
                          setCustomFields((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, value: e.target.value } : x))
                          )
                        }
                        placeholder="值"
                      />
                      <button
                        type="button"
                        className="btn btn-ghost !px-2 !py-1.5 !text-xs"
                        onClick={() =>
                          setCustomFields((prev) => prev.filter((_, j) => j !== i))
                        }
                        aria-label="删除该字段"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-2 text-xs font-medium text-accent hover:underline"
                  onClick={() => setCustomFields((prev) => [...prev, { key: "", value: "" }])}
                >
                  + 添加字段
                </button>
              </div>
            </div>
          </details>
        </div>

        <button
          type="button"
          className="btn btn-ghost !w-full"
          onClick={() => router.push("/admin/posts")}
        >
          返回列表
        </button>
      </div>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={handlePickFromPicker}
        imagesOnly={pickerMode === "cover"}
        title={pickerMode === "cover" ? "选择封面图" : "插入媒体"}
      />
    </div>
  );
}
