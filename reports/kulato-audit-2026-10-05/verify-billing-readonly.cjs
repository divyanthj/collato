const fs=require('node:fs');const path=require('node:path');const {MongoClient}=require('mongodb');
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).map(l=>l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m=>[m[1],m[2].replace(/^['"]|['"]$/g,'')]));
const client=new MongoClient(env.MONGODB_URI,{serverSelectionTimeoutMS:15000,connectTimeoutMS:15000,maxPoolSize:2,appName:'KulatoReadOnlyBillingVerification'});
const norm=v=>String(v||'').trim().toLowerCase();
async function request(type,id){
 const response=await fetch(`https://api.lemonsqueezy.com/v1/${type}/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${env.LEMONSQUEEZY_API_KEY}`,Accept:'application/vnd.api+json'},signal:AbortSignal.timeout(15000)});
 if(!response.ok)return {providerStatus:response.status};
 const data=(await response.json()).data;const a=data?.attributes||{};
 return {providerStatus:response.status,type:data?.type,status:a.status,testMode:a.test_mode??null,storeId:String(a.store_id||''),variantId:String(a.variant_id||a.first_order_item?.variant_id||''),productName:a.product_name||a.first_order_item?.product_name||null,variantName:a.variant_name||a.first_order_item?.variant_name||null,total:a.total??null,currency:a.currency||null,refunded:a.refunded??null,createdAt:a.created_at||null,updatedAt:a.updated_at||null,renewsAt:a.renews_at||null,endsAt:a.ends_at||null,cancelled:a.cancelled??null};
}
async function main(){await client.connect();const db=client.db('collato');
 const orgs=await db.collection('organizations').find({slug:{$in:['by-the-spoonful','simply-solved-s-organization','good-gut-hut']}},{projection:{slug:1,ownerEmail:1},maxTimeMS:10000}).limit(10).toArray();
 const emails=orgs.map(o=>norm(o.ownerEmail));
 const orders=await db.collection('billing_orders').find({$or:[{appUserEmail:{$in:emails}},{customerEmail:{$in:emails}}]},{projection:{orderId:1,appUserEmail:1,customerEmail:1},maxTimeMS:10000}).limit(10).toArray();
 const subs=await db.collection('billing_subscriptions').find({organizationSlug:{$in:orgs.map(o=>o.slug)}},{projection:{subscriptionId:1,organizationSlug:1},maxTimeMS:10000}).limit(10).toArray();
 const events=await db.collection('billing_webhook_events').find({eventName:'order_created'},{projection:{objectId:1,receivedAt:1},maxTimeMS:10000}).sort({receivedAt:-1}).limit(10).toArray();
 const out={auditAt:new Date().toISOString(),method:'Read-only exact-ID Lemon Squeezy GET requests; no subscription synchronization or database mutation',externalOrders:[],externalSubscriptions:[],recentWebhookOrders:[],authRecordQuality:[]};
 for(const d of orders){const org=orgs.find(o=>norm(o.ownerEmail)===norm(d.appUserEmail||d.customerEmail));out.externalOrders.push({organizationSlug:org?.slug||'unmatched',...await request('orders',d.orderId)});}
 for(const d of subs)out.externalSubscriptions.push({organizationSlug:d.organizationSlug,...await request('subscriptions',d.subscriptionId)});
 for(const d of events)out.recentWebhookOrders.push({webhookReceivedAt:d.receivedAt,...await request('orders',d.objectId)});
 const quality=await db.collection('auth_users').find({}, {projection:{name:1,email:1,emailVerified:1},maxTimeMS:10000}).sort({_id:1}).limit(1000).toArray();
 out.authRecordQuality=quality.map((d,i)=>({user:`user-${String(i+1).padStart(3,'0')}`,emailField:Object.hasOwn(d,'email')?(d.email===null?'null':d.email===''?'empty string':typeof d.email):'missing',nameField:Object.hasOwn(d,'name')?(d.name===null?'null':d.name===''?'empty string':typeof d.name):'missing'}));
 const config=JSON.parse(env.OWNER_FREE_SEATS_JSON||'{}');out.externalOwnerSeatOverrides=orgs.map(o=>({organizationSlug:o.slug,freeSeats:Number(config[norm(o.ownerEmail)]||0)}));
 fs.writeFileSync(path.resolve('reports/kulato-audit-2026-10-05/billing-verification-sanitized.json'),JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));
}
main().catch(e=>{console.error(`Read-only verification failed: ${e.name}: ${String(e.message).replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g,'[REDACTED_MONGODB_URI]')}`);process.exitCode=1;}).finally(()=>client.close());
