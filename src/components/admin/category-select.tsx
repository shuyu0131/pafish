"use client";

// 自定义分类选择器：替代原生 select 的选项面板
// 解决原生 option 展开面板无法自定义（无缩进、无搜索、系统默认样式）的问题
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export interface CategoryOption {
  id: number | string;
  name: string;
  depth: number;
}

interface CategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  categories: CategoryOption[];
  /** 面板顶部固定项：全部分类 / 未分类 / 无分类 等 */
  topOptions?: { value: string; label: string }[];
  /** 面板底部显示"新建分类"项（写文章时用） */
  allowNew?: boolean;
  /** 禁用的分类 id 列表（如父分类选择时禁用自身及子孙） */
  disabledValues?: string[];
  /** 未选择时的占位文字 */
  placeholder?: string;
  size?: "sm" | "md";
  className?: string;
}

export function CategorySelect({
  value,
  onChange,
  categories,
  topOptions = [],
  allowNew = false,
  disabledValues = [],
  placeholder = "请选择",
  size = "md",
  className = "",
}: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  // 搜索过滤：名称命中即保留（层级缩进照常显示）
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, query]);

  // 面板完整选项 = 顶部固定项 + 分类 + 新建分类
  const optionList = useMemo(() => {
    const list: { value: string; label: string; depth: number }[] = [
      ...topOptions.map((o) => ({ value: o.value, label: o.label, depth: -1 })),
      ...visible.map((c) => ({ value: String(c.id), label: c.name, depth: c.depth })),
    ];
    if (allowNew) list.push({ value: "__new__", label: "＋ 新建分类…", depth: -1 });
    return list;
  }, [topOptions, visible, allowNew]);

  const currentLabel = useMemo(() => {
    if (value === "__new__") return "＋ 新建分类…";
    const top = topOptions.find((o) => o.value === value);
    if (top) return top.label;
    const c = categories.find((x) => String(x.id) === value);
    return c ? c.name : placeholder;
  }, [value, topOptions, categories, placeholder]);

  // 点击外部 / Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // 展开时重置搜索与高亮
  useEffect(() => {
    if (open) {
      setQuery("");
      const idx = optionList.findIndex((o) => o.value === value);
      setActive(idx >= 0 ? idx : 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  // 键盘导航：上下移动高亮、Enter 选择
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, optionList.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = optionList[active];
      if (opt) choose(opt.value);
    }
  };

  const sm = size === "sm";
  const triggerCls = `input flex w-full items-center justify-between gap-2 text-left ${
    sm ? "!h-auto !w-auto !py-1.5 !text-xs" : ""
  } ${className}`;

  return (
    <div ref={rootRef} className="relative">
      <button type="button" className={triggerCls} onClick={() => setOpen((v) => !v)} onKeyDown={onKeyDown}>
        <span className={`truncate ${value === "" ? "text-muted" : ""}`}>{currentLabel}</span>
        <ChevronDown
          size={sm ? 13 : 15}
          className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-1 w-full min-w-48 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
          {categories.length >= 6 && (
            <div className="border-b border-border p-2">
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  placeholder="搜索分类…"
                  className="input !h-8 !py-1 !pl-7 !text-xs"
                />
              </div>
            </div>
          )}
          <div role="listbox" className="max-h-56 overflow-y-auto p-1">
            {optionList.map((opt, i) => {
              const disabled = disabledValues.includes(opt.value);
              return (
                <button
                  key={opt.value + opt.label}
                  type="button"
                  role="option"
                  aria-selected={opt.value === value}
                  disabled={disabled}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(opt.value)}
                  className={`flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                    i === active && !disabled ? "bg-accent-soft" : ""
                  } ${opt.value === value ? "font-medium text-accent" : "text-foreground"} ${
                    disabled ? "cursor-not-allowed text-muted opacity-60" : ""
                  }`}
                  style={{
                    paddingLeft: opt.depth > 0 ? `${0.65 + opt.depth * 0.95}rem` : "0.65rem",
                  }}
                >
                  {opt.depth > 0 && (
                    <span className="text-[10px] text-muted" aria-hidden>
                      └
                    </span>
                  )}
                  <span className="truncate">{opt.label}</span>
                  {opt.value === value && <Check size={14} className="ml-auto shrink-0 text-accent" />}
                </button>
              );
            })}
            {optionList.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-muted">没有匹配的分类</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
