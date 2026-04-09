import { getDatabase } from "@/lib/mongodb";
import { getAppBaseUrl, isResendConfigured, sendWorkspaceUpdateDigestEmail, sendWorkspaceUpdateEmail } from "@/lib/resend";

const WORKSPACE_NOTIFICATION_PREFERENCE_VALUES = new Set(["immediate", "digest", "both", "off"]);

function ensureString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeEmail(email) {
  return ensureString(email).trim().toLowerCase();
}

function normalizeMembershipStatus(status) {
  if (status === "active" || status === "declined") {
    return status;
  }

  return "invited";
}

function normalizeWorkspaceNotificationPreference(value) {
  return WORKSPACE_NOTIFICATION_PREFERENCE_VALUES.has(value) ? value : "immediate";
}

function parseWorkspaceMembers(workspaceDoc) {
  const ownerEmail = normalizeEmail(workspaceDoc?.ownerEmail);
  const rawMembers = Array.isArray(workspaceDoc?.members) ? workspaceDoc.members : [];
  const members = rawMembers
    .map((member) => {
      const email = normalizeEmail(member?.email);
      if (!email) {
        return null;
      }

      return {
        email,
        role: member?.role === "owner" ? "owner" : "member",
        status: normalizeMembershipStatus(member?.status),
        notificationPreference: normalizeWorkspaceNotificationPreference(member?.notificationPreference),
      };
    })
    .filter(Boolean);

  if (ownerEmail && !members.some((member) => member.email === ownerEmail)) {
    members.unshift({
      email: ownerEmail,
      role: "owner",
      status: "active",
      notificationPreference: "immediate",
    });
  }

  return members;
}

function parseOrganizationMembers(organizationDoc) {
  const ownerEmail = normalizeEmail(organizationDoc?.ownerEmail);
  const rawMembers = Array.isArray(organizationDoc?.members) ? organizationDoc.members : [];
  const members = rawMembers
    .map((member) => {
      const email = normalizeEmail(member?.email);
      if (!email) {
        return null;
      }

      return {
        email,
        role: member?.role === "owner" || member?.role === "admin" ? member.role : "member",
        status: normalizeMembershipStatus(member?.status),
      };
    })
    .filter(Boolean);

  if (ownerEmail && !members.some((member) => member.email === ownerEmail)) {
    members.unshift({
      email: ownerEmail,
      role: "owner",
      status: "active",
    });
  }

  return members;
}

function getWorkspaceUpdatesUrl(workspaceSlug) {
  return `${getAppBaseUrl()}/dashboard/${encodeURIComponent(workspaceSlug)}/updates`;
}

function getDigestDashboardUrl() {
  return `${getAppBaseUrl()}/dashboard`;
}

async function getWorkspaceAndOrganization(workspaceSlug) {
  const db = await getDatabase();
  const workspacesCollection = db.collection("workspaces");
  const organizationsCollection = db.collection("organizations");
  const workspaceDoc = await workspacesCollection.findOne({ slug: workspaceSlug });

  if (!workspaceDoc) {
    return { workspace: null, organization: null };
  }

  const organizationDoc = await organizationsCollection.findOne({ slug: workspaceDoc.organizationSlug });

  return {
    workspace: workspaceDoc,
    organization: organizationDoc,
  };
}

function getActiveRecipientEntries({ workspace, organization, excludeEmail }) {
  const normalizedExcludedEmail = normalizeEmail(excludeEmail);
  const workspaceMembers = parseWorkspaceMembers(workspace);
  const organizationMembers = parseOrganizationMembers(organization);
  const activeOrganizationEmails = new Set(
    organizationMembers.filter((member) => member.status === "active").map((member) => member.email)
  );

  return workspaceMembers.filter((member) => {
    if (!member.email || member.email === normalizedExcludedEmail) {
      return false;
    }

    if (member.status !== "active") {
      return false;
    }

    return activeOrganizationEmails.has(member.email);
  });
}

export async function queueWorkspaceUpdateNotifications(update) {
  if (!isResendConfigured()) {
    return { queuedCount: 0, immediateSentCount: 0 };
  }

  const { workspace, organization } = await getWorkspaceAndOrganization(update.workspaceSlug);
  if (!workspace || !organization) {
    return { queuedCount: 0, immediateSentCount: 0 };
  }

  const recipients = getActiveRecipientEntries({
    workspace,
    organization,
    excludeEmail: update.createdBy,
  }).filter((member) => member.notificationPreference !== "off");

  if (recipients.length === 0) {
    return { queuedCount: 0, immediateSentCount: 0 };
  }

  const db = await getDatabase();
  const notificationsCollection = db.collection("workspace_update_notifications");
  const updateUrl = getWorkspaceUpdatesUrl(update.workspaceSlug);
  let immediateSentCount = 0;

  for (const recipient of recipients) {
    const includeImmediate = recipient.notificationPreference === "immediate" || recipient.notificationPreference === "both";
    const includeDigest = recipient.notificationPreference === "digest" || recipient.notificationPreference === "both";
    const createdAt = new Date();
    const insertResult = await notificationsCollection.insertOne({
      workspaceSlug: update.workspaceSlug,
      workspaceName: update.workspaceName,
      organizationSlug: workspace.organizationSlug,
      organizationName: workspace.organizationName,
      updateId: update.id,
      recipientEmail: recipient.email,
      createdBy: update.createdBy,
      createdByName: update.createdByName,
      channel: update.channel,
      summary: update.structured?.summary ?? update.body,
      notificationPreference: recipient.notificationPreference,
      includeImmediate,
      includeDigest,
      immediateStatus: includeImmediate ? "pending" : "skipped",
      digestStatus: includeDigest ? "pending" : "skipped",
      createdAt,
      immediateSentAt: null,
      digestSentAt: null,
      lastError: "",
    });

    if (!includeImmediate) {
      continue;
    }

    try {
      await sendWorkspaceUpdateEmail({
        toEmail: recipient.email,
        workspaceName: update.workspaceName,
        organizationName: workspace.organizationName,
        createdByName: update.createdByName,
        summary: update.structured?.summary ?? update.body,
        channel: update.channel,
        updateUrl,
      });

      immediateSentCount += 1;
      await notificationsCollection.updateOne(
        { _id: insertResult.insertedId },
        {
          $set: {
            immediateStatus: "sent",
            immediateSentAt: new Date(),
            lastError: "",
          },
        }
      );
    } catch (error) {
      await notificationsCollection.updateOne(
        { _id: insertResult.insertedId },
        {
          $set: {
            immediateStatus: "failed",
            lastError: error instanceof Error ? error.message : "Could not send immediate update email",
          },
        }
      );
    }
  }

  return {
    queuedCount: recipients.length,
    immediateSentCount,
  };
}

export async function sendPendingWorkspaceUpdateDigests() {
  if (!isResendConfigured()) {
    return { pendingCount: 0, recipientCount: 0, sentCount: 0 };
  }

  const db = await getDatabase();
  const notificationsCollection = db.collection("workspace_update_notifications");
  const pendingDocs = await notificationsCollection
    .find({ digestStatus: "pending" })
    .sort({ createdAt: 1 })
    .toArray();

  if (pendingDocs.length === 0) {
    return { pendingCount: 0, recipientCount: 0, sentCount: 0 };
  }

  const byRecipient = new Map();
  for (const doc of pendingDocs) {
    const key = normalizeEmail(doc.recipientEmail);
    if (!key) {
      continue;
    }

    const current = byRecipient.get(key) ?? [];
    current.push(doc);
    byRecipient.set(key, current);
  }

  let sentCount = 0;
  for (const [recipientEmail, docs] of byRecipient.entries()) {
    const byWorkspace = new Map();
    for (const doc of docs) {
      const key = doc.workspaceSlug;
      const current = byWorkspace.get(key) ?? {
        workspaceSlug: doc.workspaceSlug,
        workspaceName: ensureString(doc.workspaceName, "Workspace"),
        organizationName: ensureString(doc.organizationName, "Organization"),
        updates: [],
      };
      current.updates.push({
        createdByName: ensureString(doc.createdByName, "A teammate"),
        channel: ensureString(doc.channel, "Update"),
        summary: ensureString(doc.summary, "No summary provided."),
      });
      byWorkspace.set(key, current);
    }

    try {
      await sendWorkspaceUpdateDigestEmail({
        toEmail: recipientEmail,
        workspaces: [...byWorkspace.values()],
        digestUrl: getDigestDashboardUrl(),
      });

      sentCount += 1;
      await notificationsCollection.updateMany(
        { _id: { $in: docs.map((doc) => doc._id) } },
        {
          $set: {
            digestStatus: "sent",
            digestSentAt: new Date(),
            lastError: "",
          },
        }
      );
    } catch (error) {
      await notificationsCollection.updateMany(
        { _id: { $in: docs.map((doc) => doc._id) } },
        {
          $set: {
            digestStatus: "failed",
            lastError: error instanceof Error ? error.message : "Could not send workspace digest",
          },
        }
      );
    }
  }

  return {
    pendingCount: pendingDocs.length,
    recipientCount: byRecipient.size,
    sentCount,
  };
}
