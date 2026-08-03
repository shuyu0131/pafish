"use client";

import "@uiw/react-md-editor/markdown-editor.css";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ImagePlus } from "lucide-react";
import type { ICommand } from "@uiw/react-md-editor";
import { createPage, updatePage } from "@/app/admin/actions";
import { cnCommands, cnExtraCommands } from "./md-editor-config";
import { MediaPicker } from "./media-picker";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-80 items-center justify-center border border-border rounded-xl text-sm text-muted">
      编辑器加载中…
    </div>
  ),
});

interface PageTemplateOptionView {
  name: string;
  title: string;
  source: "system" | "theme" | "plugin";
  plugin?: string;
  description?: string;
}

interface PageEditorProps {
  mode: "create" | "edit";
  pageId?: string;
  initial?: {
    title: string;
    slug: string;
    content: string;
    status: string;
    template: string;
  };
  templateOptions?: PageTemplateOptionView[];
}

export function PageEditor({ mode, pageId, initial, templateOptions = [] }: PageEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!initial?.slug);
  const [content, setContent] = useState(initial?.content ?? "");
  const [status, setStatus] = useState(initial?.status ?? "DRAFT");
  const [template, setTemplate] = useState(initial?.template ?? "default");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("请输入页面标题");
      return;
    }
    const input = {
      title: title.trim(),
      slug: slugTouched ? slug.trim() : "",
      content,
      status: status as "DRAFT" | "PUBLISHED",
      template,
    };
    setError("");
    setPending(true);
    try {
      if (mode === "create") {
        const res = await createPage(input);
        router.push(`/admin/pages/${res.id}/edit`);
      } else {
        await updatePage(pageId!, input);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
      setPending(false);
    }
  }

  // Ctrl+S 快捷键：快速保存
  const submitRef = useRef(handleSubmit);
  submitRef.current = handleSubmit;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        submitRef.current(e as unknown as React.FormEvent);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // 插入媒体：工具栏按钮打开弹窗（本地上传 / 媒体库），选择后光标处插入
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickApiRef = useRef<{ replaceSelection: (text: string) => unknown } | null>(null);

  const insertMediaCommand = useMemo<ICommand>(
    () => ({
      name: "insert-media",
      keyCommand: "insert-media",
      buttonProps: { "aria-label": "插入媒体", title: "插入媒体（本地上传或媒体库）" },
      icon: <ImagePlus size={14} />,
      execute: (_state, api) => {
        pickApiRef.current = api;
        setPickerOpen(true);
      },
    }),
    []
  );

  function handlePickFromPicker(url: string, mime: string, name: string) {
    setPickerOpen(false);
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

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!slugTouched && mode === "create") {
              setSlug(
                e.target.value
                  .trim()
                  .toLowerCase()
                  .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
                  .replace(/^-+|-+$/g, "")
              );
            }
          }}
          placeholder="页面标题"
          className="input min-w-0 flex-1 !py-2.5 !text-base font-medium"
        />
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "保存中…" : status === "PUBLISHED" ? "发布页面" : "保存草稿"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
        <label className="flex items-center gap-2">
          地址
          <span className="text-side">/pages/</span>
          <input
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            placeholder="自动生成"
            className="input !h-auto !w-52 !py-1 !text-xs"
          />
        </label>
        <label className="flex items-center gap-2">
          状态
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="input !h-auto !w-auto !py-1 !text-xs"
          >
            <option value="DRAFT">草稿</option>
            <option value="PUBLISHED">已发布</option>
          </select>
        </label>
        {templateOptions.length > 1 && (
          <label className="flex items-center gap-2" title="模板决定页面渲染方式：默认 Markdown / 主题 CSS 布局 / 插件自定义渲染">
            模板
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="input !h-auto !w-auto !py-1 !text-xs"
            >
              {templateOptions.map((t) => (
                <option key={`${t.source}:${t.name}`} value={t.name}>
                  {t.title}
                  {t.source === "theme" ? "（主题）" : t.source === "plugin" ? `（插件：${t.plugin}）` : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>

      <div data-color-mode="light">
        <MDEditor
          value={content}
          onChange={(v) => setContent(v ?? "")}
          height={420}
          preview="edit"
          commands={[...cnCommands, insertMediaCommand]}
          extraCommands={cnExtraCommands}
          visibleDragbar={false}
          textareaProps={{ placeholder: "在此输入页面内容（支持 Markdown）…" }}
        />
      </div>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={handlePickFromPicker}
        title="插入媒体"
      />
    </form>
  );
}
