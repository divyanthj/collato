import appConfig from "@/config/app";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value) {
  return String(value ?? "").replace(/"/g, "&quot;");
}

function buildEmailCard({
  kicker,
  title,
  intro,
  ctaLabel,
  ctaUrl,
  fallbackLabel = "If the button does not work, use this link:",
  footer,
}) {
  const safeKicker = escapeHtml(kicker);
  const safeTitle = escapeHtml(title);
  const safeIntro = escapeHtml(intro);
  const safeCtaLabel = escapeHtml(ctaLabel);
  const safeCtaUrl = escapeAttribute(ctaUrl);
  const safeFallbackUrl = escapeHtml(ctaUrl);
  const safeFallbackLabel = escapeHtml(fallbackLabel);
  const safeFooter = escapeHtml(footer);

  return `
    <div style="background:#f4fbff;padding:32px 16px;font-family:Arial,sans-serif;color:#18324a;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:24px;padding:32px;border:1px solid #d9e7f2;">
        <div style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:#169cb0;font-weight:700;">${safeKicker}</div>
        <h1 style="margin:16px 0 12px;font-size:30px;line-height:1.1;">${safeTitle}</h1>
        <p style="margin:0 0 16px;line-height:1.7;color:#385065;">${safeIntro}</p>
        <a href="${safeCtaUrl}" style="display:inline-block;background:linear-gradient(120deg,#169cb0 0%,#2976df 55%,#39d2ab 100%);color:#ffffff;text-decoration:none;padding:14px 20px;border-radius:14px;font-weight:700;">
          ${safeCtaLabel}
        </a>
        <p style="margin:18px 0 0;line-height:1.7;color:#5c7084;">${safeFallbackLabel}</p>
        <p style="margin:8px 0 0;word-break:break-all;color:#2976df;">${safeFallbackUrl}</p>
        <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#6f8295;">${safeFooter}</p>
      </div>
    </div>
  `;
}

export function buildMagicLinkEmailTemplate({ email, url, host }) {
  const safeEmail = escapeHtml(email);
  const safeHost = escapeHtml(host);
  const appName = appConfig.appName;

  return {
    subject: `Sign in to ${appName}`,
    text: [
      `Sign in to ${appName}`,
      "",
      `Use this link to sign in as ${email}:`,
      url,
      "",
      `Requested from ${host}. If this wasn't you, you can ignore this email.`,
    ].join("\n"),
    html: buildEmailCard({
      kicker: appName,
      title: "Your magic sign-in link",
      intro: `Use the button below to sign in as ${safeEmail}.`,
      ctaLabel: `Sign in to ${appName}`,
      ctaUrl: url,
      footer: `This link was requested from ${safeHost}. If you did not ask for it, you can safely ignore this email.`,
    }),
  };
}

export function buildOrganizationInviteEmailTemplate({
  organizationName,
  inviterName,
  inviterEmail,
  role,
  inviteUrl,
}) {
  const appName = appConfig.appName;
  const sender = inviterName || inviterEmail || "A teammate";
  const roleLabel = role === "admin" ? "admin" : "member";

  return {
    subject: `${sender} invited you to ${organizationName} on ${appName}`,
    text: [
      `You were invited to join ${organizationName} on ${appName}.`,
      `Invited by: ${sender}`,
      `Role: ${roleLabel}`,
      "",
      "Accept your invitation:",
      inviteUrl,
      "",
      "If you were not expecting this invite, you can ignore this email.",
    ].join("\n"),
    html: buildEmailCard({
      kicker: `${appName} invite`,
      title: `Join ${organizationName}`,
      intro: `${sender} invited you as ${roleLabel}. Use the button below to join and start collaborating.`,
      ctaLabel: "Accept invitation",
      ctaUrl: inviteUrl,
      footer: "If you were not expecting this invite, you can ignore this email.",
    }),
  };
}

export function buildWorkspaceInviteEmailTemplate({
  workspaceName,
  organizationName,
  inviterName,
  inviterEmail,
  inviteUrl,
}) {
  const appName = appConfig.appName;
  const sender = inviterName || inviterEmail || "A teammate";
  const workspace = escapeHtml(workspaceName);
  const organization = escapeHtml(organizationName);

  return {
    subject: `${sender} invited you to the ${workspaceName} workspace`,
    text: [
      `You were invited to the workspace "${workspaceName}" in ${organizationName}.`,
      `Invited by: ${sender}`,
      "",
      "Accept your invitation:",
      inviteUrl,
      "",
      "If you were not expecting this invite, you can ignore this email.",
    ].join("\n"),
    html: buildEmailCard({
      kicker: `${appName} workspace invite`,
      title: `Join ${workspace}`,
      intro: `${sender} invited you to the ${workspace} workspace in ${organization}. Use the button below to join it directly.`,
      ctaLabel: "Accept invitation",
      ctaUrl: inviteUrl,
      footer: "If you were not expecting this invite, you can ignore this email.",
    }),
  };
}

export function buildWorkspaceUpdateEmailTemplate({
  workspaceName,
  organizationName,
  createdByName,
  summary,
  channel,
  updateUrl,
}) {
  const appName = appConfig.appName;
  const author = createdByName || "A teammate";
  const workspace = escapeHtml(workspaceName);
  const organization = escapeHtml(organizationName);
  const safeSummary = escapeHtml(summary);
  const safeChannel = escapeHtml(channel);

  return {
    subject: `${author} posted a new update in ${workspaceName}`,
    text: [
      `${author} posted a new update in ${workspaceName}.`,
      `Organization: ${organizationName}`,
      `Channel: ${channel}`,
      "",
      summary,
      "",
      "Open the workspace updates view:",
      updateUrl,
    ].join("\n"),
    html: buildEmailCard({
      kicker: `${appName} update`,
      title: `New update in ${workspace}`,
      intro: `${author} posted a ${safeChannel.toLowerCase()} update in ${workspace} (${organization}). ${safeSummary}`,
      ctaLabel: "Open workspace updates",
      ctaUrl: updateUrl,
      footer: "You are receiving this because you are an active workspace member with update emails enabled.",
    }),
  };
}

export function buildWorkspaceUpdateDigestEmailTemplate({
  recipientEmail,
  workspaces,
  digestUrl,
}) {
  const appName = appConfig.appName;
  const workspaceCount = Array.isArray(workspaces) ? workspaces.length : 0;
  const totalUpdates = Array.isArray(workspaces)
    ? workspaces.reduce((count, workspace) => count + workspace.updates.length, 0)
    : 0;
  const sections = Array.isArray(workspaces)
    ? workspaces
        .map((workspace) => {
          const title = escapeHtml(`${workspace.workspaceName} (${workspace.organizationName})`);
          const items = workspace.updates
            .map((update) => `<li style="margin:0 0 10px;"><strong>${escapeHtml(update.createdByName)}</strong> via ${escapeHtml(update.channel)}<br /><span style="color:#5c7084;">${escapeHtml(update.summary)}</span></li>`)
            .join("");

          return `
            <div style="margin-top:18px;">
              <div style="font-size:16px;font-weight:700;color:#18324a;">${title}</div>
              <ul style="margin:12px 0 0;padding-left:18px;line-height:1.6;color:#385065;">
                ${items}
              </ul>
            </div>
          `;
        })
        .join("")
    : "";

  return {
    subject: `${appName} daily digest: ${totalUpdates} workspace update${totalUpdates === 1 ? "" : "s"}`,
    text: [
      `Daily workspace update digest for ${recipientEmail}`,
      "",
      ...workspaces.flatMap((workspace) => [
        `${workspace.workspaceName} (${workspace.organizationName})`,
        ...workspace.updates.map((update) => `- ${update.createdByName} via ${update.channel}: ${update.summary}`),
        "",
      ]),
      "Open Collato:",
      digestUrl,
    ].join("\n"),
    html: `
      <div style="background:#f4fbff;padding:32px 16px;font-family:Arial,sans-serif;color:#18324a;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:24px;padding:32px;border:1px solid #d9e7f2;">
          <div style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:#169cb0;font-weight:700;">${escapeHtml(appName)} digest</div>
          <h1 style="margin:16px 0 12px;font-size:30px;line-height:1.1;">${totalUpdates} new update${totalUpdates === 1 ? "" : "s"} across ${workspaceCount} workspace${workspaceCount === 1 ? "" : "s"}</h1>
          <p style="margin:0 0 16px;line-height:1.7;color:#385065;">Here is your daily roundup of workspace activity.</p>
          <a href="${escapeAttribute(digestUrl)}" style="display:inline-block;background:linear-gradient(120deg,#169cb0 0%,#2976df 55%,#39d2ab 100%);color:#ffffff;text-decoration:none;padding:14px 20px;border-radius:14px;font-weight:700;">
            Open Collato
          </a>
          ${sections}
          <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#6f8295;">You are receiving this because you enabled daily digest emails for at least one workspace.</p>
        </div>
      </div>
    `,
  };
}
