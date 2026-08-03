import crypto from "crypto";

// 评论默认头像：cravatar.cn（Gravatar 国内镜像），无则用 identicon 占位图
export function gravatarUrl(email: string, size = 64) {
  const hash = crypto
    .createHash("md5")
    .update(email.trim().toLowerCase())
    .digest("hex");
  return `https://cravatar.cn/avatar/${hash}?d=identicon&s=${size}`;
}

// 统一的头像地址：用户设置了 avatarUrl 用之，否则按邮箱取默认头像
export function avatarSrc(avatarUrl: string | null | undefined, email: string, size = 64) {
  return avatarUrl?.trim() || gravatarUrl(email, size);
}
