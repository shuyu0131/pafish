// 缤纷云存储插件（Bitiful S4，S3 协议兼容）
// 作为系统的「存储后端」：媒体上传时系统调用 storeFile()，删除时调用 deleteFile()。
// 认证采用 AWS SigV4 手写签名（仅 node:crypto / node:https，零依赖）；
// 缤纷云不支持 Multipart Uploads（官方文档明示），单次 PUT 上传恰好。
//
// 导出约定（系统侧 lib/plugin-storage.ts）：
//   storeFile({ buffer, ext, mime, originalName, size, width, height }, ctx)
//     -> Promise<{ url } | string>   完整公开 URL；抛错 = 拒绝，系统回退本地磁盘
//   deleteFile(url, ctx) -> Promise<void>   从 URL 反解 key 后签名 DELETE（404 视为成功）
// ctx.getSettings() 实时读取插件设置（每次操作取最新值，改配置无需重启）。
//
// 连接形态：
//   endpoint 配 path-style（https://s3.bitiful.net，默认）→ 请求 /{bucket}/{key}
//   endpoint 配桶域名（https://{bucket}.s3.bitiful.net 或自定义域名）→ 请求 /{key}
//   publicUrl 留空 → 返回 {endpoint}/{bucket}/{key}；含 {key} 占位符则按模板替换

import crypto from "node:crypto";
import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

const EMPTY_SHA256 = crypto.createHash("sha256").update("").digest("hex");

// SigV4 UriEncode：仅转义非 [A-Za-z0-9-._~] 的字符
function uriEncode(s) {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) =>
    "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

function hmac(key, data) {
  return crypto.createHmac("sha256", key).update(data).digest();
}

function sha256Hex(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

// 读取并校验插件设置；缺关键项直接抛错（系统捕获后回退本地存储）
async function loadConfig(ctx) {
  const s = await ctx.getSettings();
  const endpoint = String(s.endpoint ?? "").trim().replace(/\/+$/, "");
  const accessKey = String(s.accessKey ?? "").trim();
  const secretKey = String(s.secretKey ?? "");
  const bucket = String(s.bucket ?? "").trim();
  if (!endpoint || !accessKey || !secretKey || !bucket) {
    throw new Error("缤纷云存储未完整配置（需填写 endpoint / accessKey / secretKey / bucket）");
  }
  const region = String(s.region ?? "").trim() || "us-east-1";
  const pathPrefix = String(s.pathPrefix ?? "").trim().replace(/^\/+|\/+$/g, "");
  return {
    endpoint,
    accessKey,
    secretKey,
    bucket,
    region,
    pathPrefix: pathPrefix ? pathPrefix + "/" : "",
    publicUrl: String(s.publicUrl ?? "").trim(),
  };
}

// 对象 key：{prefix}{yyyy}/{MM}/{随机8位}.{ext}（按年月归档，便于桶内管理）
function buildKey(cfg, ext) {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const rand = crypto.randomBytes(8).toString("hex");
  return `${cfg.pathPrefix}${yyyy}/${mm}/${rand}.${ext}`;
}

// 公开访问 URL：优先 publicUrl（含 {key} 则替换，否则作为基地址拼接），
// 留空自动取 {endpoint}/{bucket}/{key}
function buildPublicUrl(cfg, key) {
  if (cfg.publicUrl) {
    return cfg.publicUrl.includes("{key}")
      ? cfg.publicUrl.replace(/\{key\}/g, key)
      : `${cfg.publicUrl.replace(/\/+$/, "")}/${key}`;
  }
  return `${cfg.endpoint}/${cfg.bucket}/${key}`;
}

// endpoint 是否为桶域名形态（virtual-hosted / 自定义域名）：host 以 {bucket}. 开头
function endpointIsBucketHosted(epUrl, bucket) {
  return epUrl.hostname === bucket || epUrl.hostname.startsWith(bucket + ".");
}

// 发起一次 AWS SigV4 签名请求；2xx 返回响应 Buffer，其余抛错
function requestSigned({ cfg, method, key, body, contentType }) {
  const endpoint = new URL(cfg.endpoint);
  const bucketHosted = endpointIsBucketHosted(endpoint, cfg.bucket);
  const objectPath = "/" + key.split("/").map(uriEncode).join("/");
  const path = bucketHosted ? objectPath : `/${cfg.bucket}${objectPath}`;
  const host = endpoint.host;
  const payloadHash = body ? sha256Hex(body) : EMPTY_SHA256;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dateStamp = amzDate.slice(0, 8);

  const canonicalHeaders =
    `host:${host}\n` + `x-amz-content-sha256:${payloadHash}\n` + `x-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest =
    `${method}\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const scope = `${dateStamp}/${cfg.region}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256Hex(canonicalRequest)}`;

  const kDate = hmac(`AWS4${cfg.secretKey}`, dateStamp);
  const kRegion = hmac(kDate, cfg.region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = hmac(kSigning, stringToSign).toString("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${cfg.accessKey}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return new Promise((resolve, reject) => {
    // 按 endpoint 协议选择请求模块（https 为生产常态；http 支持内网 S3 兼容服务/本地调试）
    const transport = endpoint.protocol === "http:" ? http : https;
    const req = transport.request(
      {
        method,
        host: endpoint.hostname,
        port: endpoint.port || (endpoint.protocol === "http:" ? 80 : 443),
        path,
        headers: {
          host,
          "x-amz-date": amzDate,
          "x-amz-content-sha256": payloadHash,
          authorization,
          ...(contentType ? { "content-type": contentType } : {}),
          ...(body ? { "content-length": body.length } : {}),
        },
        timeout: 60000,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(buf);
          } else {
            reject(
              new Error(
                `缤纷云 S4 ${method} 失败 HTTP ${res.statusCode}：${buf
                  .toString("utf8")
                  .slice(0, 300)}`
              )
            );
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("缤纷云 S4 请求超时")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// ---------- 存储后端接口 ----------
export async function storeFile(file, ctx) {
  const cfg = await loadConfig(ctx);
  const key = buildKey(cfg, file.ext);
  await requestSigned({
    cfg,
    method: "PUT",
    key,
    body: file.buffer,
    contentType: file.mime,
  });
  return { url: buildPublicUrl(cfg, key) };
}

export async function deleteFile(url, ctx) {
  const cfg = await loadConfig(ctx);
  const u = new URL(url);
  const endpoint = new URL(cfg.endpoint);
  // 反解对象 key：同一 endpoint 域下剥掉 path-style 的 bucket 前缀，其余即 key
  let key = decodeURIComponent(u.pathname.replace(/^\//, ""));
  if (u.host === endpoint.host && !endpointIsBucketHosted(endpoint, cfg.bucket)) {
    if (key === cfg.bucket) {
      return; // 误传桶根，无需删除
    }
    if (key.startsWith(cfg.bucket + "/")) key = key.slice(cfg.bucket.length + 1);
  }
  if (!key) return;
  try {
    await requestSigned({ cfg, method: "DELETE", key });
  } catch (err) {
    if (/HTTP 404/.test(err.message)) return; // 云端已不存在，视为删除成功
    throw err;
  }
}

// ---------- 生命周期 ----------
export function onActivate(ctx) {
  ctx.log("缤纷云存储已激活：媒体上传将自动存入缤纷云 S4，请到「设置」填写接入信息。");
}

export function onDeactivate(ctx) {
  ctx.log("缤纷云存储已停用：媒体上传恢复为本地磁盘存储。");
}
