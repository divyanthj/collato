const fs = require('node:fs');
const path = require('node:path');
const { MongoClient } = require('mongodb');
const envText = fs.readFileSync(path.resolve('.env.local'), 'utf8');
const env = Object.fromEntries(envText.split(/\r?\n/).map(line => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^['"]|['"]$/g, '')]));
if (!env.MONGODB_URI) throw new Error('MONGODB_URI unavailable');
const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 15000, connectTimeoutMS: 15000, maxPoolSize: 2, appName: 'KulatoReadOnlyAudit' });
const norm = v => String(v || '').trim().toLowerCase();
const time = d => d ? new Date(d).toISOString() : null;
async function main() {
  await client.connect();
  const db = client.db('collato');
  const list = await db.listCollections({}, { nameOnly: true }).toArray();
  const counts = {};
  for (const { name } of list) counts[name] = await db.collection(name).countDocuments({}, { maxTimeMS: 10000 });
  const users = await db.collection('auth_users').find({}, { projection: { name: 1, email: 1, createdAt: 1, emailVerified: 1 }, maxTimeMS: 10000 }).sort({_id: 1}).limit(1000).toArray();
  const orgs = await db.collection('organizations').find({}, { projection: { name: 1, slug: 1, ownerEmail: 1, ownerName: 1, members: 1, createdAt: 1 }, maxTimeMS: 10000 }).limit(500).toArray();
  const workspaces = await db.collection('workspaces').find({}, { projection: { name: 1, slug: 1, organizationSlug: 1, ownerEmail: 1, ownerName: 1, members: 1, createdAt: 1, 'knowledgeSummary.updatedAt': 1, 'knowledgeSummary.status': 1 }, maxTimeMS: 10000 }).limit(1000).toArray();
  const authAccounts=await db.collection('auth_accounts').find({}, {projection:{userId:1,provider:1},maxTimeMS:10000}).limit(1000).toArray();
  const knownByName = users.filter(u => /divyan?t?h?\s*j|kritika|divyant|divyanth/i.test(String(u.name || '')));
  const ownerOrgs = orgs.filter(o => /divyant|divyanth/i.test(`${o.name || ''} ${o.ownerName || ''}`) || knownByName.some(u => norm(u.email) && norm(u.email) === norm(o.ownerEmail)));
  const greenOrgs = orgs.filter(o => /green\s*sketch/i.test(o.name || '') || /green\s*sketch/i.test(o.slug || ''));
  const excludedOrgs = [...new Set([...ownerOrgs,...greenOrgs])];
  const exclusionEmails = new Set(knownByName.map(u => norm(u.email)).filter(Boolean));
  for (const o of ownerOrgs) if (norm(o.ownerEmail)) exclusionEmails.add(norm(o.ownerEmail));
  for (const o of greenOrgs) {
    if (norm(o.ownerEmail)) exclusionEmails.add(norm(o.ownerEmail));
    for (const m of o.members || []) if (norm(m.email)) exclusionEmails.add(norm(m.email));
  }
  const excludedOrgSlugs = new Set(excludedOrgs.map(o => o.slug));
  const excludedWsSlugs = new Set(workspaces.filter(w => excludedOrgSlugs.has(w.organizationSlug)).map(w => w.slug));
  const idLabels = new Map(users.map((u, i) => [String(u._id), `user-${String(i+1).padStart(3,'0')}`]));
  const ids = new Map(users.filter(u=>norm(u.email)).map(u => [norm(u.email), idLabels.get(String(u._id))]));
  let unregisteredIndex=0;
  for (const o of orgs) for (const email of [o.ownerEmail,...(o.members||[]).map(m=>m.email)]) if (norm(email)&&!ids.has(norm(email))) ids.set(norm(email),`membership-${String(++unregisteredIndex).padStart(3,'0')}`);
  const userByEmail = new Map(users.map(u => [norm(u.email), u]));
  const label = email => norm(email) ? ids.get(norm(email)) || 'unmatched-identity' : 'unknown';
  const out = {
    auditAt: new Date().toISOString(), database: 'collato', readOnly: true, collectionCounts: counts,
    exclusionMethod: 'Case-insensitive name match for Divyant/Divyanth and Kritika; owner identity and organization name match for Divyanth; organization name or slug matching Green Sketch. Exclude owner-associated org activity; exclude Green Sketch owner/members globally; retain other members of owner org when examining their own organizations. No domain-only exclusions.',
    exclusionCandidates: knownByName.map(u => ({user: label(u.email), name: u.name, firstRecorded: time(u.createdAt || u._id.getTimestamp())})),
    excludedOrganizations: excludedOrgs.map(o => ({name: o.name, slug: o.slug, owner: label(o.ownerEmail), ownerName: o.ownerName, members: (o.members||[]).map(m => ({user: label(m.email), role: m.role, status: m.status})), createdAt: time(o.createdAt)})),
    userRecordQuality:{total:users.length,withEmail:users.filter(u=>norm(u.email)).length,distinctNonemptyEmails:new Set(users.map(u=>norm(u.email)).filter(Boolean)).size,withoutEmail:users.filter(u=>!norm(u.email)).length},
    users: users.map(u => ({user: idLabels.get(String(u._id)),hasEmail:Boolean(norm(u.email)),hasName:Boolean(u.name),excluded: exclusionEmails.has(norm(u.email)), providers:authAccounts.filter(a=>String(a.userId)===String(u._id)).map(a=>a.provider),firstRecorded: time(u.createdAt || u._id.getTimestamp()), timestampSource: u.createdAt ? 'createdAt' : 'ObjectId insertion timestamp', emailVerifiedAt: time(u.emailVerified), orgs: norm(u.email)?orgs.filter(o => norm(o.ownerEmail)===norm(u.email)||(o.members||[]).some(m=>norm(m.email)===norm(u.email))).map(o=>o.slug):[]})),
    organizations: orgs.map(o => ({name:o.name,slug:o.slug,owner:label(o.ownerEmail),excluded:excludedOrgSlugs.has(o.slug),createdAt:time(o.createdAt),members:(o.members||[]).map(m=>({user:label(m.email),role:m.role,status:m.status,invitedAt:time(m.invitedAt),joinedAt:time(m.joinedAt)}))})),
    workspaces: workspaces.map(w=>({name:w.name,slug:w.slug,organizationSlug:w.organizationSlug,owner:label(w.ownerEmail),excluded:excludedWsSlugs.has(w.slug),createdAt:time(w.createdAt),knowledgeSummaryUpdatedAt:time(w.knowledgeSummary?.updatedAt),knowledgeSummaryStatus:w.knowledgeSummary?.status||null,members:(w.members||[]).map(m=>({user:label(m.email),role:m.role,status:m.status}))})),
    activity: {}, billing: {}
  };
  for (const collection of ['workspace_files','workspace_updates','workspace_tasks','workspace_chat_messages','workspace_knowledge_chunks','integration_connections','workspace_update_notifications']) {
    if (!counts[collection]) { out.activity[collection] = {total:0}; continue; }
    const fields = { workspaceSlug:1,organizationSlug:1,createdBy:1,uploadedBy:1,userEmail:1,createdAt:1,updatedAt:1,role:1,status:1,inputMethod:1,extractionStatus:1,externalProvider:1,provider:1,completedAt:1,sourceType:1 };
    const docs = await db.collection(collection).find({}, {projection:fields,maxTimeMS:10000}).limit(10000).toArray();
    const groups = new Map();
    for (const d of docs) {
      const ws = workspaces.find(w=>w.slug===d.workspaceSlug);
      const email = d.createdBy || d.uploadedBy || d.userEmail || '';
      const orgSlug = d.organizationSlug || ws?.organizationSlug || '';
      const excluded = excludedOrgSlugs.has(orgSlug)||excludedWsSlugs.has(d.workspaceSlug)||exclusionEmails.has(norm(email));
      const key = JSON.stringify([orgSlug,d.workspaceSlug||'',label(email),d.role||'',d.status||'',d.inputMethod||'',d.extractionStatus||'',d.provider||d.externalProvider||'',excluded]);
      if (!groups.has(key)) groups.set(key,{organizationSlug:orgSlug,workspaceSlug:d.workspaceSlug||'',user:label(email),role:d.role||null,status:d.status||null,inputMethod:d.inputMethod||null,extractionStatus:d.extractionStatus||null,provider:d.provider||d.externalProvider||null,excluded,count:0,firstAt:null,lastAt:null,completedCount:0});
      const g=groups.get(key);g.count++;if(d.completedAt)g.completedCount++;
      const dt=time(d.createdAt||d._id.getTimestamp());if(!g.firstAt||dt<g.firstAt)g.firstAt=dt;if(!g.lastAt||dt>g.lastAt)g.lastAt=dt;
    }
    out.activity[collection]={total:counts[collection],scanned:docs.length,groups:[...groups.values()]};
  }
  for (const collection of ['billing_orders','billing_subscriptions','billing_webhook_events']) {
    const fields={organizationSlug:1,customerEmail:1,appUserEmail:1,status:1,createdAt:1,updatedAt:1,receivedAt:1,quantity:1,total:1,currency:1,eventName:1,objectType:1,lastEvent:1,planInterval:1};
    const docs=await db.collection(collection).find({}, {projection:fields,maxTimeMS:10000}).limit(10000).toArray();
    out.billing[collection]=docs.map(d=>({organizationSlug:d.organizationSlug||null,user:label(d.appUserEmail||d.customerEmail),excluded:excludedOrgSlugs.has(d.organizationSlug)||exclusionEmails.has(norm(d.appUserEmail||d.customerEmail)),status:d.status||null,createdAt:time(d.createdAt),updatedAt:time(d.updatedAt),receivedAt:time(d.receivedAt),quantity:d.quantity||null,total:d.total||null,currency:d.currency||null,eventName:d.eventName||null,objectType:d.objectType||null,lastEvent:d.lastEvent||null,planInterval:d.planInterval||null}));
  }
  const dest=path.resolve('reports/kulato-audit-2026-10-05/usage-evidence-sanitized.json');
  fs.writeFileSync(dest,JSON.stringify(out,null,2));
  console.log(JSON.stringify({auditAt:out.auditAt,collectionCounts:counts,userRecordQuality:out.userRecordQuality,excludedOrganizations:excludedOrgs.map(o=>o.name),externalOrganizations:out.organizations.filter(o=>!o.excluded),externalActivity:Object.fromEntries(Object.entries(out.activity).map(([k,v])=>[k,{total:v.total,externalGroups:(v.groups||[]).filter(g=>!g.excluded)}])),externalBilling:Object.fromEntries(Object.entries(out.billing).filter(([k])=>k!=='billing_webhook_events').map(([k,v])=>[k,v.filter(d=>!d.excluded)])),saved:dest},null,2));
}
main().catch(e=>{console.error(`Read-only audit failed: ${e.name}: ${String(e.message).replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g,'[REDACTED_MONGODB_URI]')}`);process.exitCode=1;}).finally(()=>client.close());
