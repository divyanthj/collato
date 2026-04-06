import { MongoClient } from "mongodb";
const uri = process.env.MONGODB_URI;
if (!uri) {
    throw new Error("MONGODB_URI is not set.");
}
const globalForMongo = global;
const client = new MongoClient(uri);
export const mongoClientPromise = globalForMongo._mongoClientPromise ?? client.connect();
if (process.env.NODE_ENV !== "production") {
    globalForMongo._mongoClientPromise = mongoClientPromise;
}
export async function getDatabase() {
    const connectedClient = await mongoClientPromise;
    return connectedClient.db("collato");
}

