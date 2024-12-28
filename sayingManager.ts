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

export async function downloadJson(): Promise<SayingList | undefined> {
    const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: FILE_KEY });
    const response = await s3Client.send(command);
    const bodyStrings = (await response.Body?.transformToString("utf-8"))?.split("\n");
    if (!bodyStrings) {
        return undefined;
    }
    const parsedData: SayingList = JSON.parse(bodyStrings[0]);

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
    console.log("sayingList", sayingList);
    if (!sayingList) {
        return;
    }

    try {
        const newSayingList = modifyJson(sayingList, saying);
        await uploadJson(newSayingList);
        console.log("newSayingList", newSayingList);
    } catch (err) {
        console.error("uploadJson failed:", err);
    }
}
