import { ObjectId } from "mongodb";
import { getDatabase } from "@/lib/mongodb";
import {
  clearWorkspaceChunksForSource,
  ensureWorkspaceChunkCoverage,
  indexWorkspaceFile,
  indexWorkspaceUpdate,
  retrieveWorkspaceChunks
} from "@/lib/rag";
import { buildKnowledgeSummaryFallback, readStoredWorkspaceKnowledgeSummary } from "@/lib/workspace-summary";
import { assertOrganizationCanAddSeat, getCheckoutRequirementForUser } from "@/lib/billing";

const ACTION_ITEM_STATE_VALUES = new Set(["active", "hidden", "suppressed", "archived"]);

function ensureString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeEmail(email) {
  return ensureString(email).trim().toLowerCase();
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function parseOrganizationMembers(value, ownerEmail) {
  const rawMembers = Array.isArray(value) ? value : [];
  const members = rawMembers
    .map((member) => {
      if (!member || typeof member !== "object") {
        return null;
      }

      const item = member;
      const email = normalizeEmail(ensureString(item.email));

      if (!email) {
        return null;
      }

      return {
        email,
        role: item.role === "owner" || item.role === "admin" ? item.role : "member",
        status: item.status === "active" ? "active" : "invited"
      };
    })
    .filter(Boolean);

  if (!members.some((member) => member.email === normalizeEmail(ownerEmail))) {
    members.unshift({
      email: normalizeEmail(ownerEmail),
      role: "owner",
      status: "active"
    });
  }

  return members;
}

function parseWorkspaceMembers(value, ownerEmail) {
  const rawMembers = Array.isArray(value) ? value : [];
  const members = rawMembers
    .map((member) => {
      if (!member || typeof member !== "object") {
        return null;
      }

      const item = member;
      const email = normalizeEmail(ensureString(item.email));

      if (!email) {
        return null;
      }

      return {
        email,
        role: item.role === "owner" ? "owner" : "member",
        status: item.status === "active" ? "active" : "invited"
      };
    })
    .filter(Boolean);

  if (!members.some((member) => member.email === normalizeEmail(ownerEmail))) {
    members.unshift({
      email: normalizeEmail(ownerEmail),
      role: "owner",
      status: "active"
    });
  }

  return members;
}

function mapOrganization(doc) {
  const ownerEmail = ensureString(doc.ownerEmail, "owner@example.com");

  return {
    slug: String(doc.slug),
    name: ensureString(doc.name, "Untitled organization"),
    ownerName: ensureString(doc.ownerName, "Organization owner"),
    ownerEmail: normalizeEmail(ownerEmail),
    members: parseOrganizationMembers(doc.members, ownerEmail),
    createdAt: new Date(String(doc.createdAt ?? new Date())).toISOString()
  };
}

function mapWorkspace(doc) {
  const ownerEmail = ensureString(doc.ownerEmail, "owner@example.com");

  return {
    slug: String(doc.slug),
    organizationSlug: ensureString(doc.organizationSlug),
    organizationName: ensureString(doc.organizationName, "Organization"),
    name: ensureString(doc.name, "Untitled workspace"),
    description: ensureString(doc.description, "No description yet."),
    ownerName: ensureString(doc.ownerName, "Workspace owner"),
    ownerEmail: normalizeEmail(ownerEmail),
    members: parseWorkspaceMembers(doc.members, ownerEmail),
    knowledgeSummary: readStoredWorkspaceKnowledgeSummary(doc.knowledgeSummary),
    createdAt: new Date(String(doc.createdAt ?? new Date())).toISOString()
  };
}

function mapWorkspaceFile(doc) {
  return {
    id: String(doc._id),
    workspaceSlug: String(doc.workspaceSlug),
    workspaceName: ensureString(doc.workspaceName, "Workspace"),
    fileName: ensureString(doc.fileName, "Untitled file"),
    fileType: ensureString(doc.fileType, "Unknown"),
    sizeLabel: ensureString(doc.sizeLabel, "Unknown size"),
    knowledgeText: ensureString(doc.knowledgeText, "No extracted knowledge captured yet."),
    extractedText: ensureString(doc.extractedText),
    manualNotes: ensureString(doc.manualNotes),
    extractionStatus: ensureString(doc.extractionStatus, "legacy"),
    extractionSummary: ensureString(doc.extractionSummary),
    blobUrl: ensureString(doc.blobUrl),
    blobDownloadUrl: ensureString(doc.blobDownloadUrl),
    blobPathname: ensureString(doc.blobPathname),
    blobAccess: ensureString(doc.blobAccess, "private"),
    storageProvider: ensureString(doc.storageProvider),
    aiPrivate: Boolean(doc.aiPrivate),
    uploadedBy: ensureString(doc.uploadedBy, "Unknown user"),
    createdAt: new Date(String(doc.createdAt ?? new Date())).toISOString()
  };
}

function normalizeStructuredWorkspaceUpdate(value) {
  const structured = value && typeof value === "object" ? value : {};
  const toStringArray = (items) =>
    Array.isArray(items)
      ? items
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean)
      : [];

  return {
    summary: ensureString(structured.summary, "No summary generated yet."),
    keyPoints: toStringArray(structured.keyPoints),
    actionItems: toStringArray(structured.actionItems),
    knowledgeContribution: ensureString(
      structured.knowledgeContribution,
      "This update adds fresh team context to the workspace knowledge base."
    )
  };
}

function normalizeActionItemStates(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(([key, state]) => /^a\d+$/.test(key) && typeof state === "string" && ACTION_ITEM_STATE_VALUES.has(state))
  );
}

function mapWorkspaceUpdate(doc) {
  return {
    id: String(doc._id),
    workspaceSlug: String(doc.workspaceSlug),
    workspaceName: ensureString(doc.workspaceName, "Workspace"),
    channel: ensureString(doc.channel, "General update"),
    inputMethod: doc.inputMethod === "voice" ? "voice" : "typed",
    body: ensureString(doc.body),
    createdBy: ensureString(doc.createdBy, "unknown@example.com"),
    createdByName: ensureString(doc.createdByName, "Unknown teammate"),
    aiPrivate: Boolean(doc.aiPrivate),
    createdAt: new Date(String(doc.createdAt ?? new Date())).toISOString(),
    structured: normalizeStructuredWorkspaceUpdate(doc.structured),
    actionItemStates: normalizeActionItemStates(doc.actionItemStates)
  };
}

function getAiVisibleWorkspaceInputs(data) {
  return {
    files: data.files.filter((file) => !file.aiPrivate),
    updates: data.updates.filter((update) => !update.aiPrivate)
  };
}

function mapWorkspaceTask(doc) {
  return {
    id: String(doc._id),
    workspaceSlug: String(doc.workspaceSlug),
    workspaceName: ensureString(doc.workspaceName, "Workspace"),
    title: ensureString(doc.title, "Untitled task"),
    description: ensureString(doc.description),
    status: doc.status === "done" || doc.status === "in_progress" ? doc.status : "open",
    assigneeEmail: ensureString(doc.assigneeEmail),
    assigneeName: ensureString(doc.assigneeName),
    dueDate: doc.dueDate ? new Date(String(doc.dueDate)).toISOString() : null,
    sourceUpdateId: ensureString(doc.sourceUpdateId),
    createdBy: ensureString(doc.createdBy, "unknown@example.com"),
    createdByName: ensureString(doc.createdByName, "Unknown teammate"),
    createdAt: new Date(String(doc.createdAt ?? new Date())).toISOString(),
    completedAt: doc.completedAt ? new Date(String(doc.completedAt)).toISOString() : null
  };
}

function formatTaskStatus(status) {
  if (status === "in_progress") {
    return "In progress";
  }

  if (status === "done") {
    return "Done";
  }

  return "Open";
}

function getTaskDisplayName(task) {
  return task.assigneeName || task.assigneeEmail || "Unassigned";
}

function getTaskSnapshot(tasks) {
  const openTasks = tasks.filter((task) => task.status === "open");
  const inProgressTasks = tasks.filter((task) => task.status === "in_progress");
  const doneTasks = tasks.filter((task) => task.status === "done");

  const pendingTaskHighlights = [...openTasks, ...inProgressTasks]
    .sort((a, b) => {
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;

      if (aDue !== bDue) {
        return aDue - bDue;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, 5)
    .map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      assignee: getTaskDisplayName(task),
      dueDate: task.dueDate
    }));

  return {
    openTaskCount: openTasks.length,
    inProgressTaskCount: inProgressTasks.length,
    doneTaskCount: doneTasks.length,
    pendingTaskHighlights
  };
}

function getTaskActivityEvents(task) {
  const base = {
    workspaceSlug: task.workspaceSlug,
    actor: task.createdByName || task.createdBy || "Unknown teammate",
    actorEmail: task.createdBy || ""
  };

  const events = [
    {
      id: `task-created-${task.id}`,
      type: "task_created",
      timestamp: task.createdAt,
      title: `Task created: ${task.title}`,
      description: `Created by ${base.actor}.`,
      statusMetadata: {
        taskId: task.id,
        taskStatus: task.status
      },
      ...base
    }
  ];

  if (task.status !== "open") {
    events.push({
      id: `task-status-${task.id}`,
      type: "task_status_changed",
      timestamp: task.completedAt || task.createdAt,
      title: `Task status: ${task.title}`,
      description: `Current status is ${formatTaskStatus(task.status)}.`,
      statusMetadata: {
        taskId: task.id,
        taskStatus: task.status
      },
      ...base
    });
  }

  if (task.assigneeEmail || task.assigneeName) {
    events.push({
      id: `task-assignee-${task.id}`,
      type: "task_assignee_changed",
      timestamp: task.createdAt,
      title: `Task assignment: ${task.title}`,
      description: `Assigned to ${getTaskDisplayName(task)}.`,
      statusMetadata: {
        taskId: task.id,
        taskStatus: task.status
      },
      ...base
    });
  }

  if (task.dueDate) {
    events.push({
      id: `task-due-${task.id}`,
      type: "task_due_date_changed",
      timestamp: task.createdAt,
      title: `Task due date: ${task.title}`,
      description: `Due on ${new Date(task.dueDate).toLocaleDateString()}.`,
      statusMetadata: {
        taskId: task.id,
        taskStatus: task.status,
        dueDate: task.dueDate
      },
      ...base
    });
  }

  return events;
}

function buildWorkspaceActivityEvents({ updates, tasks }) {
  const updateEvents = updates.map((update) => ({
    id: `update-${update.id}`,
    type: "update",
    timestamp: update.createdAt,
    actor: update.createdByName || update.createdBy,
    actorEmail: update.createdBy,
    title: update.workspaceName,
    description: update.structured.summary || update.body,
    workspaceSlug: update.workspaceSlug,
    statusMetadata: {
      channel: update.channel,
      inputMethod: update.inputMethod
    },
    update
  }));

  const taskEvents = tasks.flatMap((task) => getTaskActivityEvents(task));

  return [...updateEvents, ...taskEvents].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function mapWorkspaceChatMessage(doc) {
  return {
    id: String(doc._id),
    workspaceSlug: String(doc.workspaceSlug),
    workspaceName: ensureString(doc.workspaceName, "Workspace"),
    role: doc.role === "user" ? "user" : "assistant",
    text: ensureString(doc.text),
    sources: Array.isArray(doc.sources)
      ? doc.sources.map((item) => ensureString(item)).filter(Boolean).slice(0, 8)
      : [],
    followUps: Array.isArray(doc.followUps)
      ? doc.followUps.map((item) => ensureString(item)).filter(Boolean).slice(0, 8)
      : [],
    createdBy: ensureString(doc.createdBy),
    createdByName: ensureString(doc.createdByName),
    createdAt: new Date(String(doc.createdAt ?? new Date())).toISOString()
  };
}

function slugifyName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getOrganizationMemberRecord(organization, userEmail) {
  const normalizedUserEmail = normalizeEmail(userEmail);

  if (!organization || !normalizedUserEmail) {
    return null;
  }

  if (organization.ownerEmail === normalizedUserEmail) {
    return { email: normalizedUserEmail, role: "owner", status: "active" };
  }

  return organization.members.find((member) => member.email === normalizedUserEmail) ?? null;
}

function getWorkspaceMemberRecord(workspace, userEmail) {
  const normalizedUserEmail = normalizeEmail(userEmail);

  if (!workspace || !normalizedUserEmail) {
    return null;
  }

  if (workspace.ownerEmail === normalizedUserEmail) {
    return { email: normalizedUserEmail, role: "owner", status: "active" };
  }

  return workspace.members.find((member) => member.email === normalizedUserEmail) ?? null;
}

function getOrganizationRole(organization, userEmail) {
  const member = getOrganizationMemberRecord(organization, userEmail);
  return !member || member.status !== "active" ? null : member.role;
}

function canCreateWorkspaces(organization, userEmail) {
  const role = getOrganizationRole(organization, userEmail);
  return role === "owner" || role === "admin";
}

function canManageOrganizationMembers(organization, userEmail) {
  const role = getOrganizationRole(organization, userEmail);
  return role === "owner";
}

function canManageWorkspaceMembers(workspace, organization, userEmail) {
  const normalizedUserEmail = normalizeEmail(userEmail);
  const organizationRole = getOrganizationRole(organization, normalizedUserEmail);
  return organizationRole === "owner" || organizationRole === "admin" || workspace.ownerEmail === normalizedUserEmail;
}

function hasWorkspaceAccess(workspace, organization, userEmail) {
  const normalizedUserEmail = normalizeEmail(userEmail);
  const organizationRole = getOrganizationRole(organization, normalizedUserEmail);

  if (organizationRole === "owner") {
    return true;
  }

  const workspaceMember = getWorkspaceMemberRecord(workspace, normalizedUserEmail);
  return Boolean(workspaceMember && workspaceMember.status === "active" && organizationRole);
}

async function getOrganizationBySlug(slug) {
  const db = await getDatabase();
  const organizationsCollection = db.collection("organizations");
  const doc = await organizationsCollection.findOne({ slug });
  return doc ? mapOrganization(doc) : null;
}

async function getOrganizationsForUser(userEmail) {
  const normalizedUserEmail = normalizeEmail(userEmail);

  if (!normalizedUserEmail) {
    return [];
  }

  const db = await getDatabase();
  const organizationsCollection = db.collection("organizations");
  const docs = await organizationsCollection
    .find({
      $or: [{ ownerEmail: normalizedUserEmail }, { "members.email": normalizedUserEmail }]
    })
    .sort({ createdAt: 1 })
    .toArray();

  return docs.map((doc) => mapOrganization(doc));
}

async function getOwnedOrganizationForUser(userEmail) {
  const organizations = await getOrganizationsForUser(userEmail);
  const normalizedUserEmail = normalizeEmail(userEmail);
  return organizations.find((organization) => organization.ownerEmail === normalizedUserEmail) ?? null;
}

async function resolveOrganizationContextForUser(userEmail, organizationSlug = "") {
  const organizations = await getOrganizationsForUser(userEmail);
  const normalizedUserEmail = normalizeEmail(userEmail);
  const activeOrganizations = organizations.filter((organization) => Boolean(getOrganizationRole(organization, normalizedUserEmail)));
  const requestedSlug = ensureString(organizationSlug);
  const billingByOrgSlug = new Map();
  await Promise.all(
    activeOrganizations.map(async (organization) => {
      const checkoutRequirement = await getCheckoutRequirementForUser({ userEmail, organization });
      billingByOrgSlug.set(organization.slug, checkoutRequirement);
    })
  );

  const organizationsWithAccess = activeOrganizations
    .map((organization) => {
      const role = getOrganizationRole(organization, normalizedUserEmail);
      if (!role) {
        return null;
      }
      const checkoutRequirement = billingByOrgSlug.get(organization.slug) ?? { requiresCheckout: false, billingStatus: null };
      const requiresCheckout = Boolean(checkoutRequirement.requiresCheckout);
      return {
        slug: organization.slug,
        name: organization.name,
        role,
        isOwner: role === "owner",
        isAccessible: !requiresCheckout,
        requiresCheckout,
        reason: requiresCheckout
          ? checkoutRequirement.billingStatus?.billingStateMessage || "Subscription required for this organization."
          : null
      };
    })
    .filter(Boolean);

  const accessibleOrganizations = organizationsWithAccess.filter((organization) => organization.isAccessible);
  const requestedOrganization = requestedSlug
    ? activeOrganizations.find((organization) => organization.slug === requestedSlug) ?? null
    : null;
  const requestedOrganizationOption = requestedSlug
    ? organizationsWithAccess.find((organization) => organization.slug === requestedSlug) ?? null
    : null;

  let selectedOrganization = requestedOrganization ?? null;

  const fallbackOption =
    accessibleOrganizations.find((organization) => organization.isOwner) ??
    accessibleOrganizations[0] ??
    null;

  if (!selectedOrganization && fallbackOption) {
    selectedOrganization = activeOrganizations.find((organization) => organization.slug === fallbackOption.slug) ?? null;
  }

  if (!selectedOrganization && activeOrganizations.length > 0) {
    const fallbackActiveOrganization =
      activeOrganizations.find((organization) => organization.ownerEmail === normalizedUserEmail) ??
      activeOrganizations[0] ??
      null;
    selectedOrganization = fallbackActiveOrganization;
  }

  let fallbackFromGatedOrg = null;
  if (
    requestedOrganizationOption &&
    requestedOrganizationOption.requiresCheckout &&
    selectedOrganization &&
    selectedOrganization.slug !== requestedOrganizationOption.slug
  ) {
    fallbackFromGatedOrg = {
      fromSlug: requestedOrganizationOption.slug,
      fromName: requestedOrganizationOption.name,
      toSlug: selectedOrganization.slug,
      toName: selectedOrganization.name,
      reason: requestedOrganizationOption.reason
    };
  }

  return {
    selectedOrganization,
    organizations: organizationsWithAccess,
    requestedOrganization,
    hasAccessibleOrganization: accessibleOrganizations.length > 0,
    fallbackFromGatedOrg
  };
}

async function buildUniqueOrganizationSlug(name) {
  const db = await getDatabase();
  const organizationsCollection = db.collection("organizations");
  const baseSlug = slugifyName(name) || `organization-${Date.now()}`;
  let slug = baseSlug;
  let counter = 1;

  while (await organizationsCollection.findOne({ slug })) {
    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }

  return slug;
}

async function buildUniqueWorkspaceSlug(name) {
  const db = await getDatabase();
  const workspacesCollection = db.collection("workspaces");
  const baseSlug = slugifyName(name) || `workspace-${Date.now()}`;
  let slug = baseSlug;
  let counter = 1;

  while (await workspacesCollection.findOne({ slug })) {
    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }

  return slug;
}

async function getPendingWorkspaceInvitesForUser(userEmail, organizationSlug) {
  const normalizedUserEmail = normalizeEmail(userEmail);

  if (!normalizedUserEmail) {
    return [];
  }

  const db = await getDatabase();
  const workspacesCollection = db.collection("workspaces");
  const query = {
    "members.email": normalizedUserEmail,
    "members.status": "invited"
  };

  if (organizationSlug) {
    query.organizationSlug = organizationSlug;
  }

  const docs = await workspacesCollection.find(query).sort({ createdAt: -1 }).toArray();

  return docs.map((doc) => {
    const workspace = mapWorkspace(doc);
    const member = getWorkspaceMemberRecord(workspace, normalizedUserEmail);

    return {
      slug: workspace.slug,
      name: workspace.name,
      organizationSlug: workspace.organizationSlug,
      organizationName: workspace.organizationName,
      role: member?.role ?? "member",
      status: member?.status ?? "invited"
    };
  });
}

function buildOrganizationPermissions(organization, userEmail) {
  const organizationRole = getOrganizationRole(organization, userEmail);

  return {
    organizationRole,
    canCreateWorkspaces: canCreateWorkspaces(organization, userEmail),
    canManageOrganizationMembers: canManageOrganizationMembers(organization, userEmail),
    canSeeAllWorkspaces: organizationRole === "owner"
  };
}

export async function getAccessGateData(userEmail, userName) {
  const organizations = await getOrganizationsForUser(userEmail);
  const ownedOrganization = await getOwnedOrganizationForUser(userEmail);
  const {
    selectedOrganization: activeOrganization,
    organizations: organizationOptions
  } = await resolveOrganizationContextForUser(userEmail);
  const normalizedUserEmail = normalizeEmail(userEmail);
  const pendingOrganizationInvites = organizations
    .filter((organization) => {
      const member = getOrganizationMemberRecord(organization, normalizedUserEmail);
      return member && member.status === "invited" && organization.ownerEmail !== normalizedUserEmail;
    })
    .map((organization) => {
      const member = getOrganizationMemberRecord(organization, normalizedUserEmail);
      return {
        slug: organization.slug,
        name: organization.name,
        ownerName: organization.ownerName,
        role: member?.role ?? "member",
        status: member?.status ?? "invited"
      };
    });
  const pendingWorkspaceInvites = await getPendingWorkspaceInvitesForUser(userEmail);

  return {
    hasOwnedOrganization: Boolean(ownedOrganization),
    hasActiveOrganization: Boolean(activeOrganization),
    accessibleOrganizations: organizationOptions.filter((organization) => organization.isAccessible),
    suggestedOrganizationName: userName?.trim() ? `${userName.trim()}'s Organization` : "My Organization",
    pendingOrganizationInvites,
    pendingWorkspaceInvites,
    activeOrganizationName: activeOrganization?.name ?? null
  };
}

export async function createOrganization(input) {
  const normalizedOwnerEmail = normalizeEmail(input.ownerEmail);
  const existingOwnedOrganization = await getOwnedOrganizationForUser(normalizedOwnerEmail);

  if (existingOwnedOrganization) {
    throw new Error("You already own an organization");
  }

  const db = await getDatabase();
  const organizationsCollection = db.collection("organizations");
  const name = ensureString(input.name, input.ownerName?.trim() ? `${input.ownerName.trim()}'s Organization` : "My Organization");
  const slug = await buildUniqueOrganizationSlug(name);
  const document = {
    slug,
    name,
    ownerName: ensureString(input.ownerName, "Organization owner"),
    ownerEmail: normalizedOwnerEmail,
    members: [
      {
        email: normalizedOwnerEmail,
        role: "owner",
        status: "active"
      }
    ],
    createdAt: new Date()
  };

  await organizationsCollection.insertOne(document);
  return mapOrganization(document);
}

export async function acceptOrganizationInvite(input) {
  const organization = await getOrganizationBySlug(input.organizationSlug);

  if (!organization) {
    throw new Error("Organization not found");
  }

  const normalizedUserEmail = normalizeEmail(input.userEmail);
  const member = getOrganizationMemberRecord(organization, normalizedUserEmail);

  if (!member) {
    throw new Error("Invite not found");
  }

  if (member.status === "active") {
    return organization;
  }

  await assertOrganizationCanAddSeat(organization, 1);

  const db = await getDatabase();
  const organizationsCollection = db.collection("organizations");
  await organizationsCollection.updateOne(
    { slug: input.organizationSlug, "members.email": normalizedUserEmail },
    { $set: { "members.$.status": "active" } }
  );

  const updatedDoc = await organizationsCollection.findOne({ slug: input.organizationSlug });
  return updatedDoc ? mapOrganization(updatedDoc) : organization;
}

export async function acceptWorkspaceInvite(input) {
  const workspace = await getWorkspaceBySlug(input.workspaceSlug);

  if (!workspace) {
    throw new Error("Workspace not found");
  }

  const organization = await getOrganizationBySlug(workspace.organizationSlug);

  if (!organization) {
    throw new Error("Organization not found");
  }

  const normalizedUserEmail = normalizeEmail(input.userEmail);
  const organizationRole = getOrganizationRole(organization, normalizedUserEmail);

  if (!organizationRole) {
    throw new Error("Accept the organization invite first");
  }

  const workspaceMember = getWorkspaceMemberRecord(workspace, normalizedUserEmail);

  if (!workspaceMember) {
    throw new Error("Workspace invite not found");
  }

  if (workspaceMember.status === "active") {
    return workspace;
  }

  const db = await getDatabase();
  const workspacesCollection = db.collection("workspaces");
  await workspacesCollection.updateOne(
    { slug: input.workspaceSlug, "members.email": normalizedUserEmail },
    { $set: { "members.$.status": "active" } }
  );

  const updatedDoc = await workspacesCollection.findOne({ slug: input.workspaceSlug });
  return updatedDoc ? mapWorkspace(updatedDoc) : workspace;
}

export async function acceptWorkspaceInviteSmart(input) {
  const workspace = await getWorkspaceBySlug(input.workspaceSlug);

  if (!workspace) {
    throw new Error("Workspace not found");
  }

  const organization = await getOrganizationBySlug(workspace.organizationSlug);

  if (!organization) {
    throw new Error("Organization not found");
  }

  const normalizedUserEmail = normalizeEmail(input.userEmail);
  const organizationMember = getOrganizationMemberRecord(organization, normalizedUserEmail);

  if (!organizationMember) {
    throw new Error("Organization invite not found for this workspace");
  }

  let organizationAccepted = false;
  if (organizationMember.status !== "active") {
    await acceptOrganizationInvite({
      organizationSlug: organization.slug,
      userEmail: normalizedUserEmail
    });
    organizationAccepted = true;
  }

  const workspaceMember = getWorkspaceMemberRecord(workspace, normalizedUserEmail);
  if (!workspaceMember) {
    throw new Error("Workspace invite not found");
  }

  let workspaceAccepted = false;
  if (workspaceMember.status !== "active") {
    await acceptWorkspaceInvite({
      workspaceSlug: workspace.slug,
      userEmail: normalizedUserEmail
    });
    workspaceAccepted = true;
  }

  const message = organizationAccepted
    ? workspaceAccepted
      ? "Joined organization and workspace."
      : "Organization invite accepted."
    : workspaceAccepted
      ? "Workspace invite accepted."
      : "Workspace invite already accepted.";

  return {
    organizationAccepted,
    workspaceAccepted,
    message
  };
}
export async function getWorkspaceDashboardData(userEmail, userName, organizationSlug = "") {
  if (!userEmail) {
    return {
      organization: null,
      organizations: [],
      selectedOrganizationSlug: null,
      workspaces: [],
      recentFiles: [],
      recentUpdates: [],
      permissions: {
        organizationRole: null,
        canCreateWorkspaces: false,
        canManageOrganizationMembers: false,
        canSeeAllWorkspaces: false
      },
      accessGate: null,
      pendingWorkspaceInvites: []
    };
  }

  const {
    selectedOrganization: organization,
    organizations: organizationOptions,
    requestedOrganization,
    hasAccessibleOrganization,
    fallbackFromGatedOrg
  } = await resolveOrganizationContextForUser(
    userEmail,
    organizationSlug
  );
  const baseAccessGate = await getAccessGateData(userEmail, userName);

  if (!organization) {
    const targetOrganizationForGate = requestedOrganization ?? null;
    const { requiresCheckout, billingStatus } = await getCheckoutRequirementForUser({
      userEmail,
      organization: targetOrganizationForGate
    });
    return {
      organization: null,
      organizations: organizationOptions,
      selectedOrganizationSlug: null,
      fallbackFromGatedOrg,
      workspaces: [],
      recentFiles: [],
      recentUpdates: [],
      permissions: {
        organizationRole: null,
        canCreateWorkspaces: false,
        canManageOrganizationMembers: false,
        canSeeAllWorkspaces: false
      },
      accessGate: {
        ...baseAccessGate,
        requiresCheckout: hasAccessibleOrganization ? false : requiresCheckout,
        billingStatus
      },
      pendingWorkspaceInvites: []
    };
  }

  const { requiresCheckout, billingStatus } = await getCheckoutRequirementForUser({
    userEmail,
    organization
  });

  const db = await getDatabase();
  const workspacesCollection = db.collection("workspaces");
  const filesCollection = db.collection("workspace_files");
  const updatesCollection = db.collection("workspace_updates");
  const tasksCollection = db.collection("workspace_tasks");

  const [workspaceDocs, fileDocs, updateDocs, taskDocs, pendingWorkspaceInvites] = await Promise.all([
    workspacesCollection.find({ organizationSlug: organization.slug }).sort({ createdAt: -1 }).toArray(),
    filesCollection.find({ organizationSlug: organization.slug }).sort({ createdAt: -1 }).toArray(),
    updatesCollection.find({ organizationSlug: organization.slug }).sort({ createdAt: -1 }).toArray(),
    tasksCollection.find({ organizationSlug: organization.slug }).sort({ createdAt: -1 }).toArray(),
    getPendingWorkspaceInvitesForUser(userEmail, organization.slug)
  ]);

  const allWorkspaces = workspaceDocs.map((doc) => mapWorkspace(doc));
  const visibleWorkspaces = allWorkspaces.filter((workspace) => hasWorkspaceAccess(workspace, organization, userEmail));
  const files = fileDocs.map((doc) => mapWorkspaceFile(doc));
  const updates = updateDocs.map((doc) => mapWorkspaceUpdate(doc));
  const tasks = taskDocs.map((doc) => mapWorkspaceTask(doc));

  const workspaceSummaries = visibleWorkspaces.map((workspace) => {
    const workspaceFiles = files.filter((file) => file.workspaceSlug === workspace.slug);
    const workspaceUpdates = updates.filter((update) => update.workspaceSlug === workspace.slug);
    const workspaceTasks = tasks.filter((task) => task.workspaceSlug === workspace.slug);
    const latestUpdate = workspaceUpdates[0];

    return {
      ...workspace,
      fileCount: workspaceFiles.length,
      updateCount: workspaceUpdates.length,
      taskCount: workspaceTasks.length,
      latestActivity: latestUpdate?.structured.summary ?? latestUpdate?.body
    };
  });

  const visibleSlugs = new Set(visibleWorkspaces.map((workspace) => workspace.slug));

  return {
    organization: {
      ...organization,
      workspaceCount: allWorkspaces.length
    },
    organizations: organizationOptions,
    selectedOrganizationSlug: organization.slug,
    fallbackFromGatedOrg,
    workspaces: workspaceSummaries,
    recentFiles: files.filter((file) => visibleSlugs.has(file.workspaceSlug)).slice(0, 8),
    recentUpdates: updates.filter((update) => visibleSlugs.has(update.workspaceSlug)).slice(0, 8),
    permissions: buildOrganizationPermissions(organization, userEmail),
    accessGate: {
      ...baseAccessGate,
      requiresCheckout,
      billingStatus
    },
    pendingWorkspaceInvites
  };
}

export async function getWorkspaceDetailData(slug, userEmail) {
  const workspace = await getWorkspaceBySlug(slug);

  if (!workspace) {
    return null;
  }

  const organization = await getOrganizationBySlug(workspace.organizationSlug);

  if (!organization || !hasWorkspaceAccess(workspace, organization, userEmail)) {
    return null;
  }

  const { requiresCheckout } = await getCheckoutRequirementForUser({
    userEmail,
    organization
  });

  if (requiresCheckout) {
    return null;
  }

  const db = await getDatabase();
  const filesCollection = db.collection("workspace_files");
  const updatesCollection = db.collection("workspace_updates");
  const tasksCollection = db.collection("workspace_tasks");

  const [fileDocs, updateDocs, taskDocs] = await Promise.all([
    filesCollection.find({ workspaceSlug: slug }).sort({ createdAt: -1 }).limit(20).toArray(),
    updatesCollection.find({ workspaceSlug: slug }).sort({ createdAt: -1 }).limit(20).toArray(),
    tasksCollection.find({ workspaceSlug: slug }).sort({ createdAt: -1 }).limit(50).toArray()
  ]);

  const files = fileDocs.map((doc) => mapWorkspaceFile(doc));
  const updates = updateDocs.map((doc) => mapWorkspaceUpdate(doc));
  const tasks = taskDocs.map((doc) => mapWorkspaceTask(doc));
  const taskSnapshot = getTaskSnapshot(tasks);
  const activityEvents = buildWorkspaceActivityEvents({ updates, tasks });
  const channels = uniqueStrings(updates.map((update) => update.channel));
  const keyPoints = uniqueStrings(updates.flatMap((update) => update.structured.keyPoints)).slice(0, 10);
  const actionItems = uniqueStrings(updates.flatMap((update) => update.structured.actionItems)).slice(0, 8);

  return {
    organization,
    workspace,
    files,
    updates,
    tasks,
    knowledgeSummary: {
      ...(workspace.knowledgeSummary ?? buildKnowledgeSummaryFallback({ workspace, files, updates, tasks })),
      fileCount: files.length,
      updateCount: updates.length,
      taskCount: tasks.length,
      openTaskCount: taskSnapshot.openTaskCount,
      inProgressTaskCount: taskSnapshot.inProgressTaskCount,
      doneTaskCount: taskSnapshot.doneTaskCount,
      pendingTaskHighlights: taskSnapshot.pendingTaskHighlights
    },
    activityEvents,
    taskSnapshot,
    overview: {
      channels,
      keyPoints,
      actionItems,
      openTaskCount: tasks.filter((task) => task.status !== "done").length
    },
    permissions: {
      ...buildOrganizationPermissions(organization, userEmail),
      canManageWorkspaceMembers: canManageWorkspaceMembers(workspace, organization, userEmail)
    }
  };
}

export async function resolveWorkspaceRouteForUser(requestedSlug, userEmail, userName) {
  const workspace = await getWorkspaceBySlug(requestedSlug);

  if (workspace) {
    const organization = await getOrganizationBySlug(workspace.organizationSlug);
    if (!organization) {
      return { type: "not_found" };
    }

    if (!hasWorkspaceAccess(workspace, organization, userEmail)) {
      return {
        type: "organization",
        organizationSlug: workspace.organizationSlug,
        workspaceSlug: workspace.slug,
        workspaceName: workspace.name,
        reason: "workspace_access_denied"
      };
    }

    const { requiresCheckout, billingStatus } = await getCheckoutRequirementForUser({
      userEmail,
      organization
    });

    if (requiresCheckout) {
      return {
        type: "organization",
        organizationSlug: workspace.organizationSlug,
        workspaceSlug: workspace.slug,
        workspaceName: workspace.name,
        reason: "subscription_required",
        message: billingStatus?.billingStateMessage || ""
      };
    }

    const data = await getWorkspaceDetailData(workspace.slug, userEmail);
    if (data) {
      return {
        type: "workspace",
        data,
        canonicalSlug: workspace.slug
      };
    }

    const dashboardData = await getWorkspaceDashboardData(userEmail, userName, workspace.organizationSlug);
    if (dashboardData?.organization?.slug === workspace.organizationSlug) {
      return {
        type: "organization",
        organizationSlug: workspace.organizationSlug,
        workspaceSlug: workspace.slug,
        workspaceName: workspace.name,
        reason: "workspace_unavailable"
      };
    }
  }

  const dashboardData = await getWorkspaceDashboardData(userEmail, userName, requestedSlug);
  if (dashboardData?.organization?.slug === requestedSlug) {
    return {
      type: "organization",
      organizationSlug: requestedSlug
    };
  }

  return { type: "not_found" };
}

export async function createWorkspace(input) {
  const organizationSlug = ensureString(input.organizationSlug);
  if (!organizationSlug) {
    throw new Error("Organization is required");
  }

  const organization = await getOrganizationBySlug(organizationSlug);

  if (!organization) {
    throw new Error("Organization not found");
  }

  const organizationRole = getOrganizationRole(organization, input.ownerEmail);
  if (!organizationRole) {
    throw new Error("You do not have access to this organization");
  }

  if (!canCreateWorkspaces(organization, input.ownerEmail)) {
    throw new Error("You do not have permission to create workspaces");
  }

  const slug = await buildUniqueWorkspaceSlug(input.name);
  const ownerEmail = normalizeEmail(input.ownerEmail);
  const organizationMemberEmails = new Set(organization.members.map((member) => member.email));
  const memberEmails = uniqueStrings(
    input.memberEmails
      .map((email) => normalizeEmail(email))
      .filter((email) => email && organizationMemberEmails.has(email))
  );

  const members = [
    {
      email: ownerEmail,
      role: "owner",
      status: "active"
    },
    ...memberEmails
      .filter((email) => email !== ownerEmail)
      .map((email) => {
        const organizationMember = organization.members.find((member) => member.email === email);
        return {
          email,
          role: "member",
          status: organizationMember?.status === "active" ? "active" : "invited"
        };
      })
  ];

  const db = await getDatabase();
  const workspacesCollection = db.collection("workspaces");
  const document = {
    slug,
    organizationSlug: organization.slug,
    organizationName: organization.name,
    name: input.name,
    description: input.description,
    ownerName: input.ownerName,
    ownerEmail,
    members,
    createdAt: new Date()
  };

  await workspacesCollection.insertOne(document);
  return mapWorkspace(document);
}

export async function deleteWorkspace(input) {
  const workspace = await getWorkspaceBySlug(input.workspaceSlug);
  if (!workspace) {
    throw new Error("Workspace not found");
  }

  const organization = await getOrganizationBySlug(workspace.organizationSlug);
  if (!organization) {
    throw new Error("Organization not found");
  }

  if (!canManageWorkspaceMembers(workspace, organization, input.requesterEmail)) {
    throw new Error("Only workspace owners or organization admins can delete workspaces");
  }

  const db = await getDatabase();
  const workspacesCollection = db.collection("workspaces");
  const filesCollection = db.collection("workspace_files");
  const updatesCollection = db.collection("workspace_updates");
  const tasksCollection = db.collection("workspace_tasks");
  const chunksCollection = db.collection("workspace_knowledge_chunks");
  const chatMessagesCollection = db.collection("workspace_chat_messages");

  await Promise.all([
    workspacesCollection.deleteOne({ slug: input.workspaceSlug }),
    filesCollection.deleteMany({ workspaceSlug: input.workspaceSlug }),
    updatesCollection.deleteMany({ workspaceSlug: input.workspaceSlug }),
    tasksCollection.deleteMany({ workspaceSlug: input.workspaceSlug }),
    chunksCollection.deleteMany({ workspaceSlug: input.workspaceSlug }),
    chatMessagesCollection.deleteMany({ workspaceSlug: input.workspaceSlug })
  ]);

  return { slug: workspace.slug };
}

export async function addOrganizationMember(input) {
  const organizationSlug = ensureString(input.organizationSlug);
  if (!organizationSlug) {
    throw new Error("Organization not found");
  }
  const organization = await getOrganizationBySlug(organizationSlug);

  if (!organization) {
    throw new Error("Organization not found");
  }

  if (!canManageOrganizationMembers(organization, input.requesterEmail)) {
    throw new Error("Only organization owners can add members");
  }

  const requesterRole = getOrganizationRole(organization, input.requesterEmail);
  const memberEmail = normalizeEmail(input.memberEmail);
  const requestedRole = input.role === "admin" ? "admin" : "member";

  if (!memberEmail) {
    throw new Error("Member email is required");
  }

  if (organization.members.some((member) => member.email === memberEmail)) {
    return organization;
  }

  if (requesterRole !== "owner" && requestedRole === "admin") {
    throw new Error("Only the organization owner can grant admin access");
  }

  await assertOrganizationCanAddSeat(organization, 1);

  const db = await getDatabase();
  const organizationsCollection = db.collection("organizations");
  await organizationsCollection.updateOne(
    { slug: organization.slug },
    {
      $push: {
        members: {
          email: memberEmail,
          role: requestedRole,
          status: "invited"
        }
      }
    }
  );

  const updatedDoc = await organizationsCollection.findOne({ slug: organization.slug });
  return updatedDoc ? mapOrganization(updatedDoc) : organization;
}
export async function saveWorkspaceFile(input) {
  const workspace = await getWorkspaceBySlug(input.workspaceSlug);
  if (!workspace) {
    throw new Error("Workspace not found");
  }

  const db = await getDatabase();
  const filesCollection = db.collection("workspace_files");
  const document = {
    ...input,
    aiPrivate: Boolean(input.aiPrivate),
    organizationSlug: workspace.organizationSlug,
    createdAt: new Date()
  };
  const result = await filesCollection.insertOne(document);
  const savedFile = mapWorkspaceFile({
    _id: result.insertedId,
    ...document
  });

  try {
    await indexWorkspaceFile(savedFile);
  } catch (error) {
    console.error("Failed to index workspace file for retrieval:", error);
  }

  return savedFile;
}

export async function addWorkspaceMember(input) {
  const workspace = await getWorkspaceBySlug(input.workspaceSlug);
  if (!workspace) {
    throw new Error("Workspace not found");
  }

  const organization = await getOrganizationBySlug(workspace.organizationSlug);
  if (!organization) {
    throw new Error("Organization not found");
  }

  if (!canManageWorkspaceMembers(workspace, organization, input.requesterEmail)) {
    throw new Error("Only workspace owners or organization admins can manage workspace access");
  }

  const memberEmail = normalizeEmail(input.memberEmail);
  if (!memberEmail) {
    throw new Error("Member email is required");
  }

  if (workspace.members.some((member) => member.email === memberEmail)) {
    return workspace;
  }

  const organizationMember = organization.members.find((member) => member.email === memberEmail);
  if (!organizationMember) {
    throw new Error("Only organization members can be added to a workspace");
  }

  const db = await getDatabase();
  const workspacesCollection = db.collection("workspaces");
  await workspacesCollection.updateOne(
    { slug: input.workspaceSlug },
    {
      $push: {
        members: {
          email: memberEmail,
          role: "member",
          status: organizationMember.status === "active" ? "active" : "invited"
        }
      }
    }
  );

  const updatedDoc = await workspacesCollection.findOne({ slug: input.workspaceSlug });
  return updatedDoc ? mapWorkspace(updatedDoc) : workspace;
}

export async function removeWorkspaceMember(input) {
  const workspace = await getWorkspaceBySlug(input.workspaceSlug);
  if (!workspace) {
    throw new Error("Workspace not found");
  }

  const organization = await getOrganizationBySlug(workspace.organizationSlug);
  if (!organization) {
    throw new Error("Organization not found");
  }

  const memberEmail = normalizeEmail(input.memberEmail);

  if (!canManageWorkspaceMembers(workspace, organization, input.requesterEmail)) {
    throw new Error("Only workspace owners or organization admins can manage workspace access");
  }

  if (memberEmail === workspace.ownerEmail) {
    throw new Error("The workspace owner cannot be removed");
  }

  const db = await getDatabase();
  const workspacesCollection = db.collection("workspaces");
  await workspacesCollection.updateOne({ slug: input.workspaceSlug }, { $pull: { members: { email: memberEmail } } });

  const updatedDoc = await workspacesCollection.findOne({ slug: input.workspaceSlug });
  return updatedDoc ? mapWorkspace(updatedDoc) : workspace;
}

export async function getAuthorizedWorkspace(slug, userEmail) {
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) {
    return null;
  }

  const organization = await getOrganizationBySlug(workspace.organizationSlug);
  if (!organization) {
    return null;
  }

  return hasWorkspaceAccess(workspace, organization, userEmail) ? workspace : null;
}

export async function saveWorkspaceUpdate(input) {
  const workspace = await getWorkspaceBySlug(input.workspaceSlug);
  if (!workspace) {
    throw new Error("Workspace not found");
  }

  const db = await getDatabase();
  const updatesCollection = db.collection("workspace_updates");
  const document = {
    ...input,
    aiPrivate: Boolean(input.aiPrivate),
    organizationSlug: workspace.organizationSlug,
    actionItemStates: {},
    createdAt: new Date()
  };
  const result = await updatesCollection.insertOne(document);
  const savedUpdate = mapWorkspaceUpdate({
    _id: result.insertedId,
    ...document
  });

  try {
    await indexWorkspaceUpdate(savedUpdate);
  } catch (error) {
    console.error("Failed to index workspace update for retrieval:", error);
  }

  return savedUpdate;
}

export async function updateWorkspaceUpdateActionState(input) {
  if (!/^a\d+$/.test(ensureString(input.actionKey))) {
    throw new Error("Invalid action item key");
  }

  const state = ensureString(input.state);
  if (!ACTION_ITEM_STATE_VALUES.has(state)) {
    throw new Error("Invalid action item state");
  }

  const db = await getDatabase();
  const updatesCollection = db.collection("workspace_updates");

  const result = await updatesCollection.findOneAndUpdate(
    {
      _id: new ObjectId(input.updateId),
      workspaceSlug: input.workspaceSlug
    },
    { $set: { [`actionItemStates.${input.actionKey}`]: state } },
    { returnDocument: "after" }
  );

  if (!result) {
    throw new Error("Workspace update not found");
  }

  return mapWorkspaceUpdate(result);
}

export async function isOrganizationOwner(organizationSlug, userEmail) {
  const organization = await getOrganizationBySlug(organizationSlug);
  if (!organization) {
    return false;
  }

  return organization.ownerEmail === normalizeEmail(userEmail);
}

export async function updateWorkspaceFileAiPrivacy(input) {
  if (!ObjectId.isValid(input.fileId)) {
    throw new Error("Workspace file not found");
  }

  const db = await getDatabase();
  const filesCollection = db.collection("workspace_files");
  const result = await filesCollection.findOneAndUpdate(
    {
      _id: new ObjectId(input.fileId),
      workspaceSlug: input.workspaceSlug
    },
    { $set: { aiPrivate: Boolean(input.aiPrivate) } },
    { returnDocument: "after" }
  );

  if (!result) {
    throw new Error("Workspace file not found");
  }

  const mapped = mapWorkspaceFile(result);

  if (mapped.aiPrivate) {
    await clearWorkspaceChunksForSource({
      sourceType: "file",
      sourceId: mapped.id
    });
  } else {
    await indexWorkspaceFile(mapped);
  }

  return mapped;
}

export async function updateWorkspaceUpdateAiPrivacy(input) {
  if (!ObjectId.isValid(input.updateId)) {
    throw new Error("Workspace update not found");
  }

  const db = await getDatabase();
  const updatesCollection = db.collection("workspace_updates");
  const result = await updatesCollection.findOneAndUpdate(
    {
      _id: new ObjectId(input.updateId),
      workspaceSlug: input.workspaceSlug
    },
    { $set: { aiPrivate: Boolean(input.aiPrivate) } },
    { returnDocument: "after" }
  );

  if (!result) {
    throw new Error("Workspace update not found");
  }

  const mapped = mapWorkspaceUpdate(result);

  if (mapped.aiPrivate) {
    await clearWorkspaceChunksForSource({
      sourceType: "update",
      sourceId: mapped.id
    });
  } else {
    await indexWorkspaceUpdate(mapped);
  }

  return mapped;
}

export async function createWorkspaceTask(input) {
  const workspace = await getWorkspaceBySlug(input.workspaceSlug);
  if (!workspace) {
    throw new Error("Workspace not found");
  }

  const db = await getDatabase();
  const tasksCollection = db.collection("workspace_tasks");
  const document = {
    organizationSlug: workspace.organizationSlug,
    workspaceSlug: input.workspaceSlug,
    workspaceName: input.workspaceName,
    title: input.title.trim(),
    description: ensureString(input.description),
    status: "open",
    assigneeEmail: ensureString(input.assigneeEmail),
    assigneeName: ensureString(input.assigneeName),
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
    sourceUpdateId: ensureString(input.sourceUpdateId),
    createdBy: input.createdBy,
    createdByName: input.createdByName,
    createdAt: new Date(),
    completedAt: null
  };
  const result = await tasksCollection.insertOne(document);

  return mapWorkspaceTask({
    _id: result.insertedId,
    ...document
  });
}

export async function updateWorkspaceTask(input) {
  const db = await getDatabase();
  const tasksCollection = db.collection("workspace_tasks");
  const updates = {};

  if (typeof input.status === "string") {
    updates.status = input.status;
    updates.completedAt = input.status === "done" ? new Date() : null;
  }

  if (typeof input.assigneeEmail === "string") {
    updates.assigneeEmail = input.assigneeEmail.trim().toLowerCase();
  }

  if (typeof input.assigneeName === "string") {
    updates.assigneeName = input.assigneeName.trim();
  }

  if (input.dueDate !== undefined) {
    updates.dueDate = input.dueDate ? new Date(input.dueDate) : null;
  }

  if (typeof input.title === "string" && input.title.trim()) {
    updates.title = input.title.trim();
  }

  if (typeof input.description === "string") {
    updates.description = input.description.trim();
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("No task changes were provided");
  }

  const result = await tasksCollection.findOneAndUpdate(
    {
      _id: new ObjectId(input.taskId),
      workspaceSlug: input.workspaceSlug
    },
    { $set: updates },
    { returnDocument: "after" }
  );

  if (!result) {
    throw new Error("Task not found");
  }

  return mapWorkspaceTask(result);
}
export async function getWorkspaceContext(slug, userEmail) {
  const data = await getWorkspaceDetailData(slug, userEmail);
  if (!data) {
    return null;
  }

  const aiVisible = getAiVisibleWorkspaceInputs(data);

  const fileContext = aiVisible.files
    .slice(0, 8)
    .map((file) => `File: ${file.fileName} (${file.fileType}, ${file.sizeLabel})\nKnowledge: ${file.knowledgeText}`)
    .join("\n\n");

  const updateContext = aiVisible.updates
    .slice(0, 12)
    .map(
      (update) =>
        `Update from ${update.createdByName} via ${update.channel} on ${new Date(update.createdAt).toLocaleString()}:\nRaw: ${update.body}\nSummary: ${update.structured.summary}\nKey points: ${update.structured.keyPoints.join("; ")}\nActions: ${update.structured.actionItems.join("; ")}`
    )
    .join("\n\n");

  const taskContext = data.tasks
    .slice(0, 20)
    .map(
      (task) =>
        `Task: ${task.title}\nStatus: ${task.status}\nAssignee: ${task.assigneeName || task.assigneeEmail || "Unassigned"}\nDue: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No due date"}\nDescription: ${task.description || "No description"}`
    )
    .join("\n\n");

  return {
    workspace: data.workspace,
    fileContext,
    updateContext,
    taskContext,
    sourceLabels: [
      ...aiVisible.files.map((file) => `File: ${file.fileName}`),
      ...aiVisible.updates.map((update) => `Update: ${update.createdByName} | ${new Date(update.createdAt).toLocaleDateString()}`),
      ...data.tasks.map((task) => `Task: ${task.title} | ${task.status}`)
    ]
  };
}

export async function getWorkspaceChatContext(slug, userEmail, question) {
  const data = await getWorkspaceDetailData(slug, userEmail);
  if (!data) {
    return null;
  }

  const aiVisible = getAiVisibleWorkspaceInputs(data);

  await ensureWorkspaceChunkCoverage({
    workspaceSlug: slug,
    files: aiVisible.files,
    updates: aiVisible.updates
  });

  const retrievedChunks = await retrieveWorkspaceChunks({
    workspaceSlug: slug,
    question,
    limit: 6
  });

  const retrievedContext = retrievedChunks
    .map((chunk, index) => `Source ${index + 1}: ${chunk.sourceLabel}\nTitle: ${chunk.title}\nExcerpt: ${chunk.text}`)
    .join("\n\n");

  const taskContext = data.tasks
    .slice(0, 12)
    .map(
      (task) =>
        `Task: ${task.title}\nStatus: ${task.status}\nAssignee: ${task.assigneeName || task.assigneeEmail || "Unassigned"}\nDue: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No due date"}\nDescription: ${task.description || "No description"}`
    )
    .join("\n\n");

  return {
    workspace: data.workspace,
    retrievedContext,
    taskContext,
    sourceLabels: [...new Set(retrievedChunks.map((chunk) => chunk.sourceLabel))]
  };
}

export async function getWorkspaceProgressReportContext(slug, userEmail) {
  const data = await getWorkspaceDetailData(slug, userEmail);
  if (!data) {
    return null;
  }

  const aiVisible = getAiVisibleWorkspaceInputs(data);

  await ensureWorkspaceChunkCoverage({
    workspaceSlug: slug,
    files: aiVisible.files,
    updates: aiVisible.updates
  });

  const retrievedChunks = await retrieveWorkspaceChunks({
    workspaceSlug: slug,
    question:
      "Summarize current project progress, recent accomplishments, risks, pending actions, client commitments, and next steps.",
    limit: 8
  });

  const retrievedContext = retrievedChunks
    .map((chunk, index) => `Source ${index + 1}: ${chunk.sourceLabel}\nTitle: ${chunk.title}\nExcerpt: ${chunk.text}`)
    .join("\n\n");

  const recentUpdates = aiVisible.updates
    .slice(0, 8)
    .map(
      (update) =>
        `${new Date(update.createdAt).toLocaleDateString()}: ${update.structured.summary} | Actions: ${update.structured.actionItems.join("; ") || "None"}`
    )
    .join("\n");

  const taskSnapshot = data.tasks
    .slice(0, 12)
    .map(
      (task) =>
        `${task.title} | ${task.status} | Assignee: ${task.assigneeName || task.assigneeEmail || "Unassigned"} | Due: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No due date"}`
    )
    .join("\n");

  const fileSnapshot = aiVisible.files
    .slice(0, 8)
    .map((file) => `${file.fileName} (${file.fileType}, ${file.sizeLabel})`)
    .join("\n");

  return {
    workspace: data.workspace,
    counts: {
      fileCount: aiVisible.files.length,
      updateCount: aiVisible.updates.length,
      taskCount: data.tasks.length
    },
    overview: data.overview,
    retrievedContext,
    recentUpdates,
    taskSnapshot,
    fileSnapshot,
    sourceLabels: [...new Set(retrievedChunks.map((chunk) => chunk.sourceLabel))]
  };
}

export async function getWorkspaceBySlug(slug) {
  const requestedSlug = ensureString(slug);
  if (!requestedSlug) {
    return null;
  }

  const db = await getDatabase();
  const workspacesCollection = db.collection("workspaces");
  const normalizedRequestedSlug = slugifyName(requestedSlug);

  const queryCandidates = [
    requestedSlug,
    requestedSlug.toLowerCase(),
    normalizedRequestedSlug
  ].filter(Boolean);

  let doc = await workspacesCollection.findOne({ slug: { $in: queryCandidates } });

  if (!doc) {
    const spacedNameGuess = requestedSlug.replace(/-/g, " ").trim();
    if (spacedNameGuess) {
      doc = await workspacesCollection.findOne({
        name: {
          $regex: new RegExp(`^${escapeRegex(spacedNameGuess)}$`, "i")
        }
      });
    }
  }

  return doc ? mapWorkspace(doc) : null;
}

export async function getWorkspaceUpdateById(id) {
  const db = await getDatabase();
  const updatesCollection = db.collection("workspace_updates");
  const doc = await updatesCollection.findOne({ _id: new ObjectId(id) });
  return doc ? mapWorkspaceUpdate(doc) : null;
}

export async function saveWorkspaceChatMessage(input) {
  const workspace = await getWorkspaceBySlug(input.workspaceSlug);
  if (!workspace) {
    throw new Error("Workspace not found");
  }

  const db = await getDatabase();
  const messagesCollection = db.collection("workspace_chat_messages");
  const document = {
    organizationSlug: workspace.organizationSlug,
    workspaceSlug: workspace.slug,
    workspaceName: workspace.name,
    role: input.role === "user" ? "user" : "assistant",
    text: ensureString(input.text),
    sources: Array.isArray(input.sources) ? input.sources.map((item) => ensureString(item)).filter(Boolean).slice(0, 8) : [],
    followUps: Array.isArray(input.followUps) ? input.followUps.map((item) => ensureString(item)).filter(Boolean).slice(0, 8) : [],
    createdBy: normalizeEmail(input.createdBy),
    createdByName: ensureString(input.createdByName),
    createdAt: new Date()
  };
  const result = await messagesCollection.insertOne(document);

  return mapWorkspaceChatMessage({
    _id: result.insertedId,
    ...document
  });
}

export async function getWorkspaceChatHistory(workspaceSlug, userEmail, limit = 40) {
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) {
    return [];
  }

  const organization = await getOrganizationBySlug(workspace.organizationSlug);
  if (!organization || !hasWorkspaceAccess(workspace, organization, userEmail)) {
    return [];
  }

  const db = await getDatabase();
  const messagesCollection = db.collection("workspace_chat_messages");
  const docs = await messagesCollection
    .find({
      workspaceSlug,
      createdBy: normalizeEmail(userEmail)
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return docs.reverse().map((doc) => mapWorkspaceChatMessage(doc));
}
