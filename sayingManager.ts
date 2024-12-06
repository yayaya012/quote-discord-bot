import { S3Client, GetObjectCommand, PutObjectCommand } from "npm:@aws-sdk/client-s3@3.616.0";
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

interface SayingList {
    length: number;
    saying: string[];
}

export async function downloadJson(): Promise<SayingList> {
    const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: FILE_KEY });
    const response = await s3Client.send(command);
    const body = await new Response(response.Body).text();
    console.log("body", body);
    const parsedData: SayingList = JSON.parse(body);
    console.log("parsedData", parsedData);

    console.log("BOT_TOKEN", Deno.env.get("BOT_TOKEN"));
    console.log("AWS_ACCESS_KEY_ID", Deno.env.get("AWS_ACCESS_KEY_ID"));
    console.log("AWS_SECRET_ACCESS_KEY", Deno.env.get("AWS_SECRET_ACCESS_KEY"));
    console.log("BUCKET_NAME", Deno.env.get("BUCKET_NAME"));
    return parsedData;
}

function modifyJson(data: SayingList, newSaying: string): SayingList {
    data.saying.push(newSaying);
    data.length += 1;
    return data;
}

async function uploadJson(data: SayingList): Promise<void> {
    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: FILE_KEY,
        Body: JSON.stringify(data),
        ContentType: "application/json",
    });
    await s3Client.send(command);
}

export async function addSaying(saying: string): Promise<void> {
    const sayingList = await downloadJson();
    const newSayingList = modifyJson(sayingList, saying);
    uploadJson(newSayingList);
}
