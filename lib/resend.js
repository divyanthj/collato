import { Resend } from "resend";
import appConfig from "@/config/app";

let resendClient;

function getBaseUrl() {
  return (
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    process.env.APP_URL ??
    "http://localhost:3000"
  );
}

export function getResendFromAddress() {
  return process.env.AUTH_RESEND_FROM ?? appConfig.resend.fromNoReply;
}

export function getResendReplyTo() {
  return process.env.RESEND_REPLY_TO ?? appConfig.resend.replyTo;
}

export function isResendConfigured() {
  return Boolean(process.env.AUTH_RESEND_KEY && getResendFromAddress());
}

function getResendClient() {
  if (!process.env.AUTH_RESEND_KEY) {
    throw new Error("AUTH_RESEND_KEY is not configured.");
  }

  if (!resendClient) {
    resendClient = new Resend(process.env.AUTH_RESEND_KEY);
  }

  return resendClient;
}

export async function sendResendEmail({
  to,
  subject,
  html,
  text,
  from = getResendFromAddress(),
  replyTo = getResendReplyTo(),
  tags = [],
}) {
  const client = getResendClient();
  const recipients = Array.isArray(to) ? to : [to];

  const { data, error } = await client.emails.send({
    from,
    to: recipients,
    subject,
    html,
    text,
    replyTo,
    tags,
  });

  if (error) {
    throw new Error(error.message || "Resend failed to send the email.");
  }

  return data;
}

export function buildMagicLinkEmail({ email, url, host }) {
  const escapedEmail = String(email).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapedUrl = String(url).replace(/"/g, "&quot;");

  return {
    subject: `Sign in to ${host}`,
    text: `Sign in to ${host}\n${url}\n\nIf you did not request this email, you can ignore it.`,
    html: `
      <div style="background:#f4fbff;padding:32px 16px;font-family:Arial,sans-serif;color:#18324a;">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:24px;padding:32px;border:1px solid #d9e7f2;">
          <div style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:#169cb0;font-weight:700;">${appConfig.appName}</div>
          <h1 style="margin:16px 0 12px;font-size:32px;line-height:1.05;">Your magic sign-in link</h1>
          <p style="margin:0 0 16px;line-height:1.7;color:#385065;">
            Use the button below to sign in as <strong>${escapedEmail}</strong>.
          </p>
          <a href="${escapedUrl}" style="display:inline-block;background:linear-gradient(120deg,#169cb0 0%,#2976df 55%,#39d2ab 100%);color:#ffffff;text-decoration:none;padding:14px 20px;border-radius:14px;font-weight:700;">
            Sign in to ${appConfig.appName}
          </a>
          <p style="margin:18px 0 0;line-height:1.7;color:#5c7084;">
            If the button does not work, copy and paste this URL into your browser:
          </p>
          <p style="margin:8px 0 0;word-break:break-all;color:#2976df;">${url}</p>
          <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#6f8295;">
            This link was requested from ${host}. If you did not ask for it, you can safely ignore this email.
          </p>
        </div>
      </div>
    `,
  };
}

export async function sendAuthMagicLinkEmail({ email, url }) {
  const host = new URL(url).host;
  const content = buildMagicLinkEmail({ email, url, host });

  return sendResendEmail({
    to: email,
    subject: content.subject,
    html: content.html,
    text: content.text,
    tags: [
      { name: "flow", value: "auth-magic-link" },
      { name: "app", value: "collato" },
    ],
  });
}

export async function sendTransactionalEmail({ to, subject, html, text, tags }) {
  return sendResendEmail({
    to,
    subject,
    html,
    text,
    tags,
  });
}

export function getResendSetupSummary() {
  return {
    baseUrl: getBaseUrl(),
    from: getResendFromAddress(),
    replyTo: getResendReplyTo(),
    configured: isResendConfigured(),
  };
}
