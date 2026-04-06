import { ObjectId } from "mongodb";
import { getDatabase } from "@/lib/mongodb";
function toDate(value) {
    if (!value) {
        return null;
    }
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
}
function toAdapterUser(doc) {
    return {
        id: String(doc._id),
        name: typeof doc.name === "string" ? doc.name : null,
        email: typeof doc.email === "string" ? doc.email : "",
        emailVerified: toDate(doc.emailVerified),
        image: typeof doc.image === "string" ? doc.image : null
    };
}
function toAdapterSession(doc) {
    return {
        sessionToken: String(doc.sessionToken),
        userId: String(doc.userId),
        expires: toDate(doc.expires) ?? new Date()
    };
}
function toAdapterAccount(doc) {
    return {
        userId: String(doc.userId),
        type: String(doc.type),
        provider: String(doc.provider),
        providerAccountId: String(doc.providerAccountId),
        refresh_token: typeof doc.refresh_token === "string" ? doc.refresh_token : undefined,
        access_token: typeof doc.access_token === "string" ? doc.access_token : undefined,
        expires_at: typeof doc.expires_at === "number" ? doc.expires_at : undefined,
        token_type: typeof doc.token_type === "string" ? doc.token_type : undefined,
        scope: typeof doc.scope === "string" ? doc.scope : undefined,
        id_token: typeof doc.id_token === "string" ? doc.id_token : undefined,
        session_state: typeof doc.session_state === "string" ? doc.session_state : undefined
    };
}
export function MongoWorkspaceAuthAdapter() {
    return {
        async createUser(user) {
            const db = await getDatabase();
            const collection = db.collection("auth_users");
            const document = {
                name: user.name ?? null,
                email: user.email,
                emailVerified: user.emailVerified ?? null,
                image: user.image ?? null
            };
            const result = await collection.insertOne(document);
            return toAdapterUser({ _id: result.insertedId, ...document });
        },
        async getUser(id) {
            const db = await getDatabase();
            const collection = db.collection("auth_users");
            if (!ObjectId.isValid(id)) {
                return null;
            }
            const user = await collection.findOne({ _id: new ObjectId(id) });
            return user ? toAdapterUser(user) : null;
        },
        async getUserByEmail(email) {
            const db = await getDatabase();
            const collection = db.collection("auth_users");
            const user = await collection.findOne({ email: email.toLowerCase() });
            return user ? toAdapterUser(user) : null;
        },
        async getUserByAccount({ provider, providerAccountId }) {
            const db = await getDatabase();
            const accounts = db.collection("auth_accounts");
            const users = db.collection("auth_users");
            const account = await accounts.findOne({ provider, providerAccountId });
            if (!account) {
                return null;
            }
            const userId = typeof account.userId === "string" ? account.userId : "";
            if (!ObjectId.isValid(userId)) {
                return null;
            }
            const user = await users.findOne({ _id: new ObjectId(userId) });
            return user ? toAdapterUser(user) : null;
        },
        async updateUser(user) {
            const db = await getDatabase();
            const collection = db.collection("auth_users");
            if (!ObjectId.isValid(user.id)) {
                throw new Error("Invalid user id");
            }
            await collection.updateOne({ _id: new ObjectId(user.id) }, {
                $set: {
                    name: user.name ?? null,
                    email: user.email,
                    emailVerified: user.emailVerified ?? null,
                    image: user.image ?? null
                }
            });
            const updated = await collection.findOne({ _id: new ObjectId(user.id) });
            if (!updated) {
                throw new Error("User not found");
            }
            return toAdapterUser(updated);
        },
        async deleteUser(userId) {
            const db = await getDatabase();
            if (!ObjectId.isValid(userId)) {
                return;
            }
            await Promise.all([
                db.collection("auth_users").deleteOne({ _id: new ObjectId(userId) }),
                db.collection("auth_accounts").deleteMany({ userId }),
                db.collection("auth_sessions").deleteMany({ userId })
            ]);
        },
        async linkAccount(account) {
            const db = await getDatabase();
            const collection = db.collection("auth_accounts");
            await collection.updateOne({
                provider: account.provider,
                providerAccountId: account.providerAccountId
            }, { $set: account }, { upsert: true });
            return toAdapterAccount(account);
        },
        async unlinkAccount({ provider, providerAccountId }) {
            const db = await getDatabase();
            await db.collection("auth_accounts").deleteOne({ provider, providerAccountId });
        },
        async createSession(session) {
            const db = await getDatabase();
            const collection = db.collection("auth_sessions");
            await collection.insertOne(session);
            return toAdapterSession(session);
        },
        async getSessionAndUser(sessionToken) {
            const db = await getDatabase();
            const sessions = db.collection("auth_sessions");
            const users = db.collection("auth_users");
            const session = await sessions.findOne({ sessionToken });
            if (!session) {
                return null;
            }
            const userId = typeof session.userId === "string" ? session.userId : "";
            if (!ObjectId.isValid(userId)) {
                return null;
            }
            const user = await users.findOne({ _id: new ObjectId(userId) });
            if (!user) {
                return null;
            }
            return {
                session: toAdapterSession(session),
                user: toAdapterUser(user)
            };
        },
        async updateSession(session) {
            const db = await getDatabase();
            const collection = db.collection("auth_sessions");
            await collection.updateOne({ sessionToken: session.sessionToken }, { $set: session });
            const updated = await collection.findOne({ sessionToken: session.sessionToken });
            return updated ? toAdapterSession(updated) : null;
        },
        async deleteSession(sessionToken) {
            const db = await getDatabase();
            await db.collection("auth_sessions").deleteOne({ sessionToken });
        },
        async createVerificationToken(token) {
            const db = await getDatabase();
            const collection = db.collection("auth_verification_tokens");
            await collection.insertOne(token);
            return token;
        },
        async useVerificationToken({ identifier, token }) {
            const db = await getDatabase();
            const collection = db.collection("auth_verification_tokens");
            const verificationToken = await collection.findOneAndDelete({ identifier, token });
            if (!verificationToken) {
                return null;
            }
            return {
                identifier: String(verificationToken.identifier),
                token: String(verificationToken.token),
                expires: toDate(verificationToken.expires) ?? new Date()
            };
        }
    };
}
