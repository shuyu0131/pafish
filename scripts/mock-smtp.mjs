// 本地 mock SMTP 收信服务器（测试用）
// 用法：node scripts/mock-smtp.mjs [port]   （默认 2525）
// 收到邮件后：控制台打印摘要 + 写入 ~/.pafish-mock-mail.json（全部邮件）
// 方便测试脚本读取验证码：node scripts/mock-smtp.mjs --dump
import { SMTPServer } from "smtp-server";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = Number(process.argv[2] ?? 2525);
const DUMP_FILE = path.join(os.homedir(), ".pafish-mock-mail.json");

function loadAll() {
  if (existsSync(DUMP_FILE)) {
    try {
      return JSON.parse(readFileSync(DUMP_FILE, "utf-8"));
    } catch {
      return [];
    }
  }
  return [];
}

function saveAll(mails) {
  writeFileSync(DUMP_FILE, JSON.stringify(mails, null, 2));
}

// --dump：打印已收到的邮件（提取验证码），不发不监听
if (process.argv.includes("--dump")) {
  const mails = loadAll();
  if (mails.length === 0) {
    console.log("(no mails yet)");
  } else {
    for (const m of mails) {
      // nodemailer 对含中文的正文用 base64 传输（Content-Transfer-Encoding: base64），需解码
      let text = m.text;
      if (/Content-Transfer-Encoding: base64/i.test(text)) {
        // 空行分隔 header 与 body；body 只取合法 base64 字符再解码
        const body = text.split(/\r?\n\r?\n/).slice(1).join("");
        try {
          text = Buffer.from(body.replace(/[^A-Za-z0-9+/=]/g, ""), "base64").toString("utf-8");
        } catch {
          /* 解码失败保留原文 */
        }
      }
      const codeMatch = text.match(/\b(\d{6})\b/);
      console.log(
        `[${m.date}] to=${m.to} subject="${m.subject}" code=${codeMatch?.[1] ?? "-"}`
      );
      console.log(text.replace(/^/gm, "  | ").slice(0, 600));
      console.log("");
    }
  }
  process.exit(0);
}

const server = new SMTPServer({
  disabledCommands: ["STARTTLS", "AUTH"],
  authOptional: true,
  onData(stream, session, callback) {
    let text = "";
    stream.on("data", (chunk) => (text += chunk.toString("utf-8")));
    stream.on("end", () => {
      const mail = {
        date: new Date().toISOString(),
        from: session.envelope.mailFrom.address,
        to: session.envelope.rcptTo.map((r) => r.address).join(","),
        text,
      };
      // 提取主题行
      const subjMatch = text.match(/^Subject: (.+)$/im);
      mail.subject = subjMatch ? subjMatch[1] : "(no subject)";
      const mails = loadAll();
      mails.push(mail);
      saveAll(mails);
      console.log(`📨 ${mail.to} <- "${mail.subject}" (${text.length} bytes)`);
      callback();
    });
  },
});

server.listen(PORT, () => {
  console.log(`mock SMTP listening on 127.0.0.1:${PORT} (no auth, no TLS)`);
  console.log(`mails saved to ${DUMP_FILE}`);
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});
