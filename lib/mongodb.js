import { MongoClient } from "mongodb";
const uri = process.env.MONGODB_URI;
if (!uri) {
    throw new Error("MONGODB_URI is not set.");
}
const globalForMongo = global;
function createMongoClient() {
    return new MongoClient(uri, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000
    });
}
async function getMongoClient() {
    if (!globalForMongo._mongoClientPromise) {
        const client = createMongoClient();
        globalForMongo._mongoClientPromise = client.connect().catch((error) => {
            globalForMongo._mongoClientPromise = null;
            throw error;
        });
    }
    return globalForMongo._mongoClientPromise;
}
export const mongoClientPromise = getMongoClient();
export async function getDatabase() {
    const connectedClient = await getMongoClient();
    return connectedClient.db("collato");
}

