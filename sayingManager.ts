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
    /** 0 のときのみ抽選対象。投稿したら 3 にセット、以後 1 ずつデクリメント */
    coolDown?: number;
}
interface SayingList {
    items: SayingItem[];
}

export async function downloadJson(): Promise<SayingList | undefined> {
    const body = await bucket.getObject(FILE_KEY);
    if (!body) return;

    const text = await new Response(body.body).text();
    const parsed: SayingList = JSON.parse(text);

    if (!parsed || !Array.isArray(parsed.items)) {
        console.error("[downloadJson] invalid schema (items missing)");
        return;
    }

    // 既存データ互換: coolDown が無いアイテムは 0 に補完
    const normalized: SayingList = {
        items: parsed.items.map((it) => ({
            text: String(it.text ?? ""),
            imageKey: typeof it.imageKey === "string" ? it.imageKey : undefined,
            coolDown: typeof it.coolDown === "number" ? it.coolDown : 0,
        })),
    };

    return normalized;
}

// async function uploadJson(data: SayingList): Promise<void> {
//     await bucket.putObject(FILE_KEY, encoder.encode(JSON.stringify(data)), { contentType: "application/json" });
// }

export async function saveSayingList(data: SayingList): Promise<void> {
    await bucket.putObject(FILE_KEY, encoder.encode(JSON.stringify(data)), {
        contentType: "application/json",
    });
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

    // 新規はすぐ抽選対象にしたいので coolDown は 0 で追加
    data.items.push({ text, imageKey, coolDown: 0 });

    await saveSayingList(data);
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
