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

async function streamToString(stream: ReadableStream<Uint8Array> | null): Promise<string> {
    if (!stream) {
        throw new Error("Stream is null");
    }
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let result = "";
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value, { stream: true });
    }
    result += decoder.decode(); // End of the stream
    return result;
}

export async function downloadJson(): Promise<SayingList> {
    const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: FILE_KEY });
    const response = await s3Client.send(command);
    const body = await streamToString(response.Body as ReadableStream<Uint8Array>);
    console.log("body", body);
    const parsedData: SayingList = JSON.parse(body);
    console.log("parsedData", parsedData);
    return parsedData;
}

// export async function downloadJson(): Promise<SayingList> {
//     const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: FILE_KEY });
//     const response = await s3Client.send(command);
//     const body = await new Response(response.Body).text();
//     console.log("body", body);
//     const parsedData: SayingList = JSON.parse(body);
//     console.log("parsedData", parsedData);

//     return parsedData;
// }

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
