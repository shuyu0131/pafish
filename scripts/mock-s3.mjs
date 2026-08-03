// Mock S3 服务器：验证缤纷云存储插件的 SigV4 签名链路（零依赖，仅 node 内置模块）。
// 用法：node scripts/mock-s3.mjs [port]
// - 按 SigV4 规则重算每个请求的签名，与 Authorization 头比对，不匹配返回 403
// - PUT 存入内存对象，DELETE 移除（对象不存在返回 404），其余方法 405
// - 每次请求打印一行到 stdout：METHOD path [签名有效|403]
// - 另监听 /__state 返回对象清单（GET 调试用）

import http from "node:http";
import crypto from "node:crypto";

const PORT = Number(process.argv[2] || 19000);
const ACCESS_KEY = "mock-access-key-0000";
const SECRET_KEY = "mock-secret-key-0000";
const REGION = "us-east-1";
const SERVICE = "s3";

const objects = new Map(); // key -> Buffer

function hmac(key, data) {
  return crypto.createHmac("sha256", key).update(data).digest();
}
function sha256Hex(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}
const EMPTY_SHA = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

// 重算 SigV4 签名，与请求头比对
function verifySigV4(method, rawPath, headers, body) {
  const auth = headers["authorization"] || "";
  const m = auth.match(
    /^AWS4-HMAC-SHA256 Credential=([^/]+)\/(\d{8})\/([^/]+)\/([^/]+)\/aws4_request, SignedHeaders=([^,]+), Signature=([0-9a-f]{64})$/
  );
  if (!m) return { ok: false, reason: "Authorization 头格式错误" };
  const [, accessKey, dateStamp, region, service, signedHeaders, signature] = m;
  if (accessKey !== ACCESS_KEY) return { ok: false, reason: "AccessKey 不匹配" };
  if (region !== REGION) return { ok: false, reason: "Region 不匹配" };
  if (service !== SERVICE) return { ok: false, reason: "Service 不匹配" };

  const amzDate = headers["x-amz-date"];
  const payloadHash = headers["x-amz-content-sha256"];
  const payload = body || Buffer.alloc(0);
  if (payloadHash !== sha256Hex(payload)) {
    return { ok: false, reason: "x-amz-content-sha256 与 body 不符" };
  }
  if (!amzDate || !amzDate.startsWith(dateStamp)) {
    return { ok: false, reason: "x-amz-date 与签名日期不符" };
  }

  const host = headers["host"];
  const headerNames = signedHeaders.split(";").sort();
  let canonicalHeaders = "";
  for (const n of headerNames) {
    const v = n === "host" ? host : headers[n];
    if (v === undefined) return { ok: false, reason: `缺少 SignedHeader: ${n}` };
    canonicalHeaders += `${n}:${String(v).trim()}\n`;
  }
  const canonicalRequest =
    `${method}\n${rawPath}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256Hex(canonicalRequest)}`;

  const kDate = hmac(`AWS4${SECRET_KEY}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const expect = hmac(kSigning, stringToSign).toString("hex");
  if (expect !== signature) return { ok: false, reason: "签名不匹配" };
  return { ok: true, reason: "签名有效" };
}

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const body = Buffer.concat(chunks);
    const url = new URL(req.url, `http://${req.headers.host}`);
    const rawPath = url.pathname;

    // 调试端点：列出对象
    if (req.method === "GET" && rawPath === "/__state") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          keys: [...objects.keys()],
          count: objects.size,
          totalBytes: [...objects.values()].reduce((a, b) => a + b.length, 0),
        })
      );
      return;
    }

    const v = verifySigV4(req.method, rawPath, req.headers, body);
    console.log(`[mock-s3] ${req.method} ${rawPath} → ${v.ok ? "SIG-OK" : "403 " + v.reason}`);
    if (!v.ok) {
      res.writeHead(403, { "Content-Type": "application/xml" });
      res.end(`<Error><Code>SignatureDoesNotMatch</Code><Message>${v.reason}</Message></Error>`);
      return;
    }

    const key = rawPath.replace(/^\//, "");
    if (req.method === "PUT") {
      objects.set(key, body);
      res.writeHead(200, { "Content-Type": "application/xml" });
      res.end();
    } else if (req.method === "DELETE") {
      if (!objects.has(key)) {
        console.log(`[mock-s3] DELETE ${rawPath} → 404 NoSuchKey`);
        res.writeHead(404, { "Content-Type": "application/xml" });
        res.end("<Error><Code>NoSuchKey</Code></Error>");
        return;
      }
      objects.delete(key);
      res.writeHead(204);
      res.end();
    } else {
      res.writeHead(405);
      res.end();
    }
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[mock-s3] 监听 http://127.0.0.1:${PORT}（ACCESS_KEY=${ACCESS_KEY}）`);
  console.log(`[mock-s3] 对象清单 GET /__state`);
});
