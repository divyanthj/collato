import { ObjectId } from "mongodb";
import { getDatabase } from "@/lib/mongodb";
import { ensureWorkspaceChunkCoverage, indexWorkspaceFile, indexWorkspaceUpdate, retrieveWorkspaceChunks } from "@/lib/rag";

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
    createdAt: new Date(String(doc.createdAt ?? new Date())).toISOString(),
    structured: normalizeStructuredWorkspaceUpdate(doc.structured)
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

function slugifyName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
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
  return role === "owner" || role === "admin";
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

async function getPrimaryOrganizationForUser(userEmail) {
  const organizations = await getOrganizationsForUser(userEmail);
  const normalizedUserEmail = normalizeEmail(userEmail);

  return (
    organizations.find((organization) => organization.ownerEmail === normalizedUserEmail) ??
    organizations.find((organization) => getOrganizationRole(organization, normalizedUserEmail)) ??
    null
  );
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
  const activeOrganization = await getPrimaryOrganizationForUser(userEmail);
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
export async function getWorkspaceDashboardData(userEmail, userName) {
  if (!userEmail) {
    return {
      organization: null,
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

  const organization = await getPrimaryOrganizationForUser(userEmail);
  const accessGate = await getAccessGateData(userEmail, userName);

  if (!organization) {
    return {
      organization: null,
      workspaces: [],
      recentFiles: [],
      recentUpdates: [],
      permissions: {
        organizationRole: null,
        canCreateWorkspaces: false,
        canManageOrganizationMembers: false,
        canSeeAllWorkspaces: false
      },
      accessGate,
      pendingWorkspaceInvites: []
    };
  }

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
    workspaces: workspaceSummaries,
    recentFiles: files.filter((file) => visibleSlugs.has(file.workspaceSlug)).slice(0, 8),
    recentUpdates: updates.filter((update) => visibleSlugs.has(update.workspaceSlug)).slice(0, 8),
    permissions: buildOrganizationPermissions(organization, userEmail),
    accessGate,
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
  const channels = uniqueStrings(updates.map((update) => update.channel));
  const keyPoints = uniqueStrings(updates.flatMap((update) => update.structured.keyPoints)).slice(0, 10);
  const actionItems = uniqueStrings(updates.flatMap((update) => update.structured.actionItems)).slice(0, 8);

  return {
    organization,
    workspace,
    files,
    updates,
    tasks,
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

export async function createWorkspace(input) {
  const organization = await getPrimaryOrganizationForUser(input.ownerEmail);

  if (!organization) {
    throw new Error("You must join or create an organization first");
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

  await Promise.all([
    workspacesCollection.deleteOne({ slug: input.workspaceSlug }),
    filesCollection.deleteMany({ workspaceSlug: input.workspaceSlug }),
    updatesCollection.deleteMany({ workspaceSlug: input.workspaceSlug }),
    tasksCollection.deleteMany({ workspaceSlug: input.workspaceSlug }),
    chunksCollection.deleteMany({ workspaceSlug: input.workspaceSlug })
  ]);

  return { slug: workspace.slug };
}

export async function addOrganizationMember(input) {
  const organization = await getPrimaryOrganizationForUser(input.requesterEmail);

  if (!organization) {
    throw new Error("Organization not found");
  }

  if (!canManageOrganizationMembers(organization, input.requesterEmail)) {
    throw new Error("Only organization owners or admins can add members");
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
    organizationSlug: workspace.organizationSlug,
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

  const fileContext = data.files
    .slice(0, 8)
    .map((file) => `File: ${file.fileName} (${file.fileType}, ${file.sizeLabel})\nKnowledge: ${file.knowledgeText}`)
    .join("\n\n");

  const updateContext = data.updates
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
      ...data.files.map((file) => `File: ${file.fileName}`),
      ...data.updates.map((update) => `Update: ${update.createdByName} | ${new Date(update.createdAt).toLocaleDateString()}`),
      ...data.tasks.map((task) => `Task: ${task.title} | ${task.status}`)
    ]
  };
}

export async function getWorkspaceChatContext(slug, userEmail, question) {
  const data = await getWorkspaceDetailData(slug, userEmail);
  if (!data) {
    return null;
  }

  await ensureWorkspaceChunkCoverage({
    workspaceSlug: slug,
    files: data.files,
    updates: data.updates
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

  await ensureWorkspaceChunkCoverage({
    workspaceSlug: slug,
    files: data.files,
    updates: data.updates
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

  const recentUpdates = data.updates
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

  const fileSnapshot = data.files
    .slice(0, 8)
    .map((file) => `${file.fileName} (${file.fileType}, ${file.sizeLabel})`)
    .join("\n");

  return {
    workspace: data.workspace,
    counts: {
      fileCount: data.files.length,
      updateCount: data.updates.length,
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
  const db = await getDatabase();
  const workspacesCollection = db.collection("workspaces");
  const doc = await workspacesCollection.findOne({ slug });
  return doc ? mapWorkspace(doc) : null;
}

export async function getWorkspaceUpdateById(id) {
  const db = await getDatabase();
  const updatesCollection = db.collection("workspace_updates");
  const doc = await updatesCollection.findOne({ _id: new ObjectId(id) });
  return doc ? mapWorkspaceUpdate(doc) : null;
}
