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

// function bufferToString(buffer: Uint8Array): string {
//     const decoder = new TextDecoder("utf-8");
//     return decoder.decode(buffer);
// }

// export async function downloadJson(): Promise<SayingList> {
//     const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: FILE_KEY });
//     const response = await s3Client.send(command);
//     const body = await response.Body?.arrayBuffer(); // Convert stream to arrayBuffer
//     const text = bufferToString(new Uint8Array(body)); // Convert arrayBuffer to string
//     console.log("body", text);
//     const parsedData: SayingList = JSON.parse(text);
//     console.log("parsedData", parsedData);
//     return parsedData;
// }

export async function downloadJson(): Promise<SayingList> {
    const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: FILE_KEY });
    const response = await s3Client.send(command);
    const text = await new Response(response.Body).text();
    const json = await new Response(response.Body).json();
    const arrayBuffer = await new Response(response.Body).arrayBuffer();
    const body = await new Response(response.Body).body;
    const blob = await new Response(response.Body).blob();
    console.log("json", json);
    console.log("arrayBuffer", arrayBuffer);
    console.log("body", body);
    console.log("blob", blob);
    const parsedData: SayingList = JSON.parse(text);
    console.log("parsedData", parsedData);

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
