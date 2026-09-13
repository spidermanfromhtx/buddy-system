import { resolveMx } from "node:dns/promises";
import { connect } from "node:net";
import { connect as tlsConnect } from "node:tls";
import type { Socket } from "node:net";

function readReply(socket: Socket) {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("smtp timeout")), 15000);
    let buf = "";
    const onData = (chunk: Buffer) => {
      buf += chunk.toString("utf8");
      if (/(^|\n)\d{3} /.test(buf.replace(/\r/g, "\n"))) {
        cleanup();
        resolve(buf);
      }
    };
    const onErr = (err: Error) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      clearTimeout(timer);
      socket.off("data", onData);
      socket.off("error", onErr);
    };
    socket.on("data", onData);
    socket.on("error", onErr);
  });
}

async function cmd(socket: Socket, line?: string) {
  if (line) socket.write(`${line}\r\n`);
  const text = await readReply(socket);
  const code = Number(text.trim().slice(0, 3));
  if (!Number.isFinite(code)) throw new Error("bad smtp reply");
  return { code, text };
}

export async function sendMailMx(to: string, subject: string, body: string) {
  const domain = to.split("@")[1];
  if (!domain) throw new Error("bad address");
  const mx = (await resolveMx(domain)).sort((a, b) => a.priority - b.priority);
  if (!mx.length) throw new Error("no mail server");
  let last = "no mx";
  for (const row of mx.slice(0, 3)) {
    try {
      await deliver(row.exchange, to, subject, body);
      return;
    } catch (err) {
      last = err instanceof Error ? err.message : "smtp failed";
    }
  }
  throw new Error(last);
}

async function deliver(host: string, to: string, subject: string, body: string) {
  const from = "noreply@buddy-system.app";
  const socket = await new Promise<Socket>((resolve, reject) => {
    const s = connect({ host, port: 25 }, () => resolve(s));
    s.setTimeout(15000, () => {
      s.destroy();
      reject(new Error("connect timeout"));
    });
    s.on("error", reject);
  });
  try {
    const banner = await cmd(socket);
    if (banner.code !== 220) throw new Error(banner.text);
    let hello = await cmd(socket, "EHLO buddy-system.app");
    if (hello.code !== 250) hello = await cmd(socket, "HELO buddy-system.app");
    if (hello.text.includes("STARTTLS")) {
      const ready = await cmd(socket, "STARTTLS");
      if (ready.code !== 220) throw new Error("starttls refused");
      const secure = tlsConnect({ socket, host, servername: host });
      await new Promise<void>((resolve, reject) => {
        secure.once("secureConnect", () => resolve());
        secure.once("error", reject);
      });
      const ehlo = await cmd(secure, "EHLO buddy-system.app");
      if (ehlo.code !== 250) throw new Error(ehlo.text);
      await finish(secure, from, to, subject, body);
      return;
    }
    await finish(socket, from, to, subject, body);
  } finally {
    socket.destroy();
  }
}

async function finish(socket: Socket, from: string, to: string, subject: string, body: string) {
  const mail = await cmd(socket, `MAIL FROM:<${from}>`);
  if (mail.code !== 250) throw new Error(mail.text);
  const rcpt = await cmd(socket, `RCPT TO:<${to}>`);
  if (rcpt.code >= 400) throw new Error(rcpt.text);
  const data = await cmd(socket, "DATA");
  if (data.code !== 354) throw new Error(data.text);
  const message = [
    `From: Buddy System <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    body.replace(/^\./gm, ".."),
    ".",
  ].join("\r\n");
  const done = await cmd(socket, message);
  if (done.code !== 250) throw new Error(done.text);
  await cmd(socket, "QUIT").catch(() => undefined);
}
