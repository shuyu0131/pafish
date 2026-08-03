"use server";

import { redirect } from "next/navigation";
import { requireApiUser } from "@/lib/auth";
import { canAdmin } from "@/lib/constants";
import {
  fetchCatalog,
  installFromStore,
  updateFromStore,
  type StoreKind,
} from "@/lib/store";

// 商店安装/更新：管理员权限（与插件管理一致，涉及安装代码）
async function guardStore() {
  const user = await requireApiUser();
  if (!user) redirect("/login");
  if (!canAdmin(user.role)) throw new Error("没有权限执行此操作");
  return user;
}

async function findStoreItem(kind: StoreKind, name: string) {
  const { items, base, error } = await fetchCatalog(kind);
  if (error) throw new Error(error);
  const item = items.find((i) => i.name === name);
  if (!item) throw new Error(`商店中不存在${kind === "theme" ? "主题" : "插件"}“${name}”`);
  return { item, base };
}

/** 安装商店条目（未安装时） */
export async function installFromStoreAction(kind: StoreKind, name: string) {
  await guardStore();
  const { item, base } = await findStoreItem(kind, name);
  const r = await installFromStore(kind, item.name, base, item.zip);
  return { ok: true, title: r.title, version: r.version };
}

/** 更新商店条目（覆盖安装，失败回滚，设置保留） */
export async function updateFromStoreAction(kind: StoreKind, name: string) {
  await guardStore();
  const { item, base } = await findStoreItem(kind, name);
  const r = await updateFromStore(kind, item.name, base, item.zip);
  return { ok: true, title: r.title, version: r.version };
}
