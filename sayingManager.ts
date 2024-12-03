import { S3Client, GetObjectCommand, PutObjectCommand } from "npm:@aws-sdk/client-s3";

// 環境変数のロード
import "$std/dotenv/load.ts";
import { Buffer } from "node:buffer";

// S3クライアントの設定
const s3Client = new S3Client({
    region: "ap-northeast-1",
    credentials: {
        accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID")!,
        secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
    },
});

const BUCKET_NAME = Deno.env.get("BUCKET_NAME")!;
const FILE_KEY = "sayingList.json";

// S3からsayingsリストを取得する関数
export async function getSayingList(): Promise<{ length: number; saying: string[] }> {
    try {
        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: FILE_KEY,
        });

        const response = await s3Client.send(command);

        // response.BodyはReadableStreamとして返される
        const stream = response.Body as ReadableStream<Uint8Array>;

        // ストリームをBufferに変換するために、ストリームを読み取る
        const buffer = await streamToBuffer(stream);

        // Bufferを文字列に変換
        const result = buffer.toString("utf-8");

        console.log("Fetched data from S3:", result);

        try {
            // 文字列をJSONとして解析
            const parsedData = JSON.parse(result);
            console.log("Parsed data:", JSON.stringify(parsedData, null, 2));
            return parsedData;
        } catch (error) {
            console.warn(`Invalid JSON data in S3, returning default format: ${error}`);
            return { length: 0, saying: [] };
        }
    } catch (error) {
        console.error(`Error fetching data from S3: ${error}`);
        return { length: 0, saying: [] };
    }
}

// ReadableStreamをBufferに変換するユーティリティ関数
async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let done = false;

    while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
            chunks.push(value);
        }
    }

    return Buffer.concat(chunks);
}

// 新しいsayingをS3に追加する関数
export async function addSaying(saying: string): Promise<void> {
    try {
        const data = await getSayingList();
        data.saying.push(saying);
        data.length = data.saying.length;

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: FILE_KEY,
            Body: JSON.stringify(data, null, 2),
            ContentType: "application/json",
        });
        await s3Client.send(command);
    } catch (error) {
        console.error("Error updating data to S3:", error);
        throw error;
    }
}
