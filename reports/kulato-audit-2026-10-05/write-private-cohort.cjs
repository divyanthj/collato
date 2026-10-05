const fs=require('node:fs');const path=require('node:path');const {MongoClient}=require('mongodb');
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).map(l=>l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m=>[m[1],m[2].replace(/^['"]|['"]$/g,'')]));
const client=new MongoClient(env.MONGODB_URI,{serverSelectionTimeoutMS:15000,connectTimeoutMS:15000,maxPoolSize:1,appName:'KulatoReadOnlyExactCohort'});
const norm=v=>String(v||'').trim().toLowerCase();
async function main(){await client.connect();const db=client.db('collato');
 const knownUsers=await db.collection('auth_users').find({name:{$regex:'divyant|divyanth|kritika',$options:'i'}},{projection:{name:1,email:1},maxTimeMS:10000}).limit(30).toArray();
 const orgs=await db.collection('organizations').find({slug:{$in:['divyanth-jayaraj-s-organization','divyanth-s-organization','somethingsomething','green-sketch-consultants']}},{projection:{slug:1,ownerEmail:1,members:1},maxTimeMS:10000}).limit(10).toArray();
 const emails=new Set(knownUsers.map(u=>norm(u.email)).filter(Boolean));
 for(const o of orgs){if(norm(o.ownerEmail))emails.add(norm(o.ownerEmail));if(o.slug==='green-sketch-consultants')for(const m of o.members||[])if(norm(m.email))emails.add(norm(m.email));}
 const dest=path.resolve('../reports/kulato-audit-2026-10-05/analytics-internal-emails.private.txt');
 fs.writeFileSync(dest,[...emails].sort().join(',')+'\n');console.log(JSON.stringify({count:emails.size,path:dest,contains:'Exact known owner identities and recorded Green Sketch owner/member emails; no personal-network org expansion'}));
}
main().catch(e=>{console.error(`Read-only cohort query failed: ${e.name}`);process.exitCode=1;}).finally(()=>client.close());
