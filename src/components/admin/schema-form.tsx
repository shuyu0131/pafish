"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MediaPicker } from "./media-picker";

// 通用 schema 驱动表单：插件设置页与主题设置页共用
// 字段体系对标 WordPress CSF：text/textarea/checkbox/select + color/switcher/radio/image/password，
// 支持 group 分组 Tab 与 show_if 等值依赖联动。
export interface SchemaField {
  key: string;
  label: string;
  type: "text" | "textarea" | "checkbox" | "select" | "color" | "switcher" | "radio" | "image" | "password";
  options?: Record<string, string>; // select/radio: value -> 显示名
  default?: string;
  placeholder?: string;
  group?: string; // Tab 分组名，缺省 "常规"
  show_if?: { key: string; value: string }; // 等值依赖：依赖字段值匹配才显示
}

interface SchemaFormProps {
  fields: SchemaField[];
  initial: Record<string, string>;
  onSubmit: (data: Record<string, string>) => Promise<unknown>;
  canEdit: boolean;
  submitLabel?: string;
  hint?: string;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function SchemaForm({
  fields,
  initial,
  onSubmit,
  canEdit,
  submitLabel = "保存",
  hint,
}: SchemaFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const f of fields) {
      v[f.key] = initial[f.key] ?? f.default ?? (f.type === "checkbox" || f.type === "switcher" ? "0" : "");
    }
    return v;
  });
  const [activeGroup, setActiveGroup] = useState("");
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  // 分组（保持 manifest 首现顺序，缺省 "常规"）；仅一组时不渲染 Tab 栏
  const groups: string[] = [];
  for (const f of fields) {
    const g = f.group ?? "常规";
    if (!groups.includes(g)) groups.push(g);
  }
  const safeGroup = groups.includes(activeGroup) ? activeGroup : groups[0] ?? "常规";
  // 当前 Tab 内的可见字段（show_if 等值联动）
  const visibleFields = fields.filter((f) => {
    if ((f.group ?? "常规") !== safeGroup) return false;
    if (f.show_if && values[f.show_if.key] !== f.show_if.value) return false;
    return true;
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setPending(true);
    try {
      await onSubmit(values);
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="card space-y-4 p-6">
        {groups.length > 1 && (
          <div className="flex flex-wrap gap-1 border-b border-border pb-3">
            {groups.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setActiveGroup(g)}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  g === safeGroup
                    ? "bg-accent-soft font-medium text-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        )}

        {visibleFields.map((f) => {
          const value = values[f.key] ?? "";
          return (
            <div key={f.key}>
              {f.type === "checkbox" ? (
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--accent)]"
                    checked={value === "1"}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f.key]: e.target.checked ? "1" : "0" }))
                    }
                    disabled={!canEdit}
                  />
                  <span className="text-sm">{f.label}</span>
                </label>
              ) : f.type === "switcher" ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm">{f.label}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={value === "1"}
                    onClick={() =>
                      setValues((v) => ({ ...v, [f.key]: value === "1" ? "0" : "1" }))
                    }
                    disabled={!canEdit}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                      value === "1" ? "bg-accent" : "bg-muted/50"
                    }`}
                  >
                    <span
                      className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        value === "1" ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                </div>
              ) : (
                <>
                  <label className="label">{f.label}</label>
                  {f.type === "textarea" ? (
                    <textarea
                      className="input min-h-32 resize-y font-mono !text-xs"
                      value={value}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      disabled={!canEdit}
                    />
                  ) : f.type === "select" ? (
                    <select
                      className="input"
                      value={value}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      disabled={!canEdit}
                    >
                      {Object.entries(f.options ?? {}).map(([val, label]) => (
                        <option key={val} value={val}>
                          {label}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "radio" ? (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(f.options ?? {}).map(([val, label]) => (
                        <label
                          key={val}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                            value === val
                              ? "border-accent bg-accent-soft"
                              : "border-border hover:border-accent/50"
                          }`}
                        >
                          <input
                            type="radio"
                            className="h-4 w-4 accent-[var(--accent)]"
                            checked={value === val}
                            onChange={() => setValues((v) => ({ ...v, [f.key]: val }))}
                            disabled={!canEdit}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  ) : f.type === "color" ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={HEX_RE.test(value) ? value : "#000000"}
                        onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                        disabled={!canEdit}
                        className="h-9 w-12 cursor-pointer rounded-md border border-border bg-transparent p-1 disabled:opacity-50"
                      />
                      <input
                        className="input font-mono !text-xs"
                        value={value}
                        onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                        placeholder="#rrggbb"
                        disabled={!canEdit}
                      />
                    </div>
                  ) : f.type === "image" ? (
                    <div className="flex items-start gap-3">
                      {value ? (
                        <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/20">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={value}
                            alt={f.label}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-[11px] text-muted">
                          无图片
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-2">
                        <input
                          className="input font-mono !text-xs"
                          value={value}
                          onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                          placeholder="/uploads/xxx 或外部图片 URL"
                          disabled={!canEdit}
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn btn-outline !px-3 !py-1.5 !text-xs"
                            onClick={() => setPickerFor(f.key)}
                            disabled={!canEdit}
                          >
                            从媒体库选择
                          </button>
                          {value && (
                            <button
                              type="button"
                              className="btn btn-outline !px-3 !py-1.5 !text-xs !text-danger"
                              onClick={() => setValues((v) => ({ ...v, [f.key]: "" }))}
                              disabled={!canEdit}
                            >
                              清除
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : f.type === "password" ? (
                    <input
                      type="password"
                      className="input"
                      value={value}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      disabled={!canEdit}
                      autoComplete="new-password"
                    />
                  ) : (
                    <input
                      className="input"
                      value={value}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      disabled={!canEdit}
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
        {visibleFields.length === 0 && (
          <p className="py-4 text-center text-sm text-muted">该分组暂无设置项。</p>
        )}
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {saved && <p className="text-sm text-accent">✓ 已保存</p>}

      {canEdit && (
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "保存中…" : submitLabel}
        </button>
      )}

      {pickerFor && (
        <MediaPicker
          open
          imagesOnly
          title="选择图片"
          onClose={() => setPickerFor(null)}
          onPick={(url) => {
            setValues((v) => ({ ...v, [pickerFor]: url }));
            setPickerFor(null);
          }}
        />
      )}
    </form>
  );
}
