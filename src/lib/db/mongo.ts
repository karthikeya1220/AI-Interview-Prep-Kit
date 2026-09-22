import { MongoClient, ObjectId } from "mongodb";

let clientPromise: Promise<MongoClient> | null = null;

export { ObjectId };

export async function db() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  clientPromise ||= new MongoClient(uri).connect();
  return (await clientPromise).db();
}
