// import { S3Client, GetObjectCommand, PutObjectCommand } from "npm:@aws-sdk/client-s3@latest";
import { GetObjectResponse, S3 } from "https://deno.land/x/s3@0.5.0/mod.ts";
import "$std/dotenv/load.ts";
import { encoder } from "https://deno.land/x/s3@0.5.0/src/request.ts";

// S3クライアントの設定
const s3 = new S3({
    region: "ap-northeast-1",
    accessKeyID: Deno.env.get("AWS_ACCESS_KEY_ID")!,
    secretKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
});

// const BUCKET_NAME = Deno.env.get("BUCKET_NAME")!;
const FILE_KEY = "sayingList.json";
const bucket = s3.getBucket(Deno.env.get("BUCKET_NAME")!);

interface SayingItem {
    text: string;
    imageKey?: string;
}
interface SayingList {
    items: SayingItem[];
}

export async function downloadJson(): Promise<SayingList | undefined> {
    const body = await bucket.getObject(FILE_KEY);
    if (!body) return;

    const text = await new Response(body.body).text();
    const parsed = JSON.parse(text);

    if (!parsed || !Array.isArray(parsed.items)) {
        console.error("[downloadJson] invalid schema (items missing)");
        return;
    }
    return parsed as SayingList;
}

async function uploadJson(data: SayingList): Promise<void> {
    await bucket.putObject(FILE_KEY, encoder.encode(JSON.stringify(data)), { contentType: "application/json" });
}

export async function addSaying(
    text: string,
    image?: { bytes: Uint8Array; filename: string; contentType?: string }
): Promise<void> {
    const data = await downloadJson();
    if (!data) return;

    let imageKey: string | undefined;
    if (image) {
        imageKey = await uploadImageToS3(image.bytes, image.filename, image.contentType);
    }

    data.items.push({ text, imageKey });
    await uploadJson(data);
}

function inferExt(contentType?: string, fallback = "bin"): string {
    if (!contentType) return fallback;
    const map: Record<string, string> = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/gif": "gif",
        "image/webp": "webp",
        "image/heic": "heic",
    };
    return map[contentType] ?? fallback;
}

async function uploadImageToS3(bytes: Uint8Array, filename?: string, contentType?: string): Promise<string> {
    const ext = contentType ? inferExt(contentType, "bin") : filename?.split(".").pop() ?? "bin";
    const key = `images/${crypto.randomUUID()}.${ext}`;
    await bucket.putObject(key, bytes, { contentType: contentType ?? "application/octet-stream" });
    return key;
}

export async function getImage(imageKey: string): Promise<GetObjectResponse | undefined> {
    return await bucket.getObject(imageKey);
}
