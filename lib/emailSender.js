import { Resend } from "resend";
import appConfig from "@/config/app";
import {
  buildMagicLinkEmailTemplate,
  buildOrganizationInviteEmailTemplate,
  buildWorkspaceInviteEmailTemplate,
} from "@/lib/emailTemplate";

let resendClient;

export function getAppBaseUrl() {
  return process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? "http://localhost:3000";
}

function getResendApiKey() {
  return process.env.RESEND_API_KEY ?? process.env.AUTH_RESEND_KEY ?? "";
}

export function getResendFromAddress() {
  return process.env.AUTH_RESEND_FROM ?? process.env.RESEND_FROM ?? appConfig.resend.fromNoReply;
}

export function getResendReplyTo() {
  return process.env.RESEND_REPLY_TO ?? appConfig.resend.replyTo;
}

export function isResendConfigured() {
  return Boolean(getResendApiKey() && getResendFromAddress());
}

function getResendClient() {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
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

export async function sendAuthMagicLinkEmail({ email, url }) {
  const host = new URL(url).host;
  const content = buildMagicLinkEmailTemplate({ email, url, host });

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

export async function sendOrganizationInviteEmail({
  toEmail,
  organizationName,
  inviterName,
  inviterEmail,
  role,
  inviteUrl = `${getAppBaseUrl()}/dashboard`,
}) {
  const content = buildOrganizationInviteEmailTemplate({
    organizationName,
    inviterName,
    inviterEmail,
    role,
    inviteUrl,
  });

  return sendResendEmail({
    to: toEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    tags: [
      { name: "flow", value: "organization-invite" },
      { name: "app", value: "collato" },
    ],
  });
}

export async function sendWorkspaceInviteEmail({
  toEmail,
  workspaceName,
  organizationName,
  inviterName,
  inviterEmail,
  inviteUrl = `${getAppBaseUrl()}/dashboard`,
}) {
  const content = buildWorkspaceInviteEmailTemplate({
    workspaceName,
    organizationName,
    inviterName,
    inviterEmail,
    inviteUrl,
  });

  return sendResendEmail({
    to: toEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    tags: [
      { name: "flow", value: "workspace-invite" },
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
    baseUrl: getAppBaseUrl(),
    from: getResendFromAddress(),
    replyTo: getResendReplyTo(),
    configured: isResendConfigured(),
    apiKeySource: process.env.RESEND_API_KEY ? "RESEND_API_KEY" : process.env.AUTH_RESEND_KEY ? "AUTH_RESEND_KEY" : null,
  };
}
