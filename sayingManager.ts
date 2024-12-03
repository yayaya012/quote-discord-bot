import { S3Client, GetObjectCommand, PutObjectCommand } from "npm:@aws-sdk/client-s3";

// 環境変数のロード
import "$std/dotenv/load.ts";

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
export async function getSayingList(): Promise<string[]> {
    try {
        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: FILE_KEY,
        });
        const response = await s3Client.send(command);
        const body = await new Response(response.Body as ReadableStream).text();
        return JSON.parse(body);
    } catch (error) {
        console.error("Error fetching data from S3:", error);
        return [];
    }
}

// 新しいsayingsをS3に追加する関数
export async function addSaying(saying: string): Promise<void> {
    try {
        const sayings = await getSayingList();
        // ファイルが空であれば空の配列として初期化
        const updatedSayings = sayings.length > 0 ? sayings : [];
        updatedSayings.push(saying);

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: FILE_KEY,
            Body: JSON.stringify(updatedSayings, null, 2),
            ContentType: "application/json",
        });
        await s3Client.send(command);
    } catch (error) {
        console.error("Error updating data to S3:", error);
        throw error;
    }
}
