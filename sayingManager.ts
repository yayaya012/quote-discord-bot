// import { S3Client, GetObjectCommand, PutObjectCommand } from "npm:@aws-sdk/client-s3@latest";
import { S3 } from "https://deno.land/x/s3@0.5.0/mod.ts";
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

interface SayingList {
    length: number;
    saying: string[];
}

export async function downloadJson(): Promise<SayingList | undefined> {
    const body = await bucket.getObject(FILE_KEY);

    if (!body) {
        return;
    }

    const data = await new Response(body.body).text();
    console.log("File 'test' contains:", data);
    const parsedData: SayingList = JSON.parse(data);

    return parsedData;
}

function modifyJson(data: SayingList, newSaying: string): SayingList {
    data.saying.push(newSaying);
    data.length += 1;
    return data;
}

async function uploadJson(data: SayingList): Promise<void> {
    await bucket.putObject(FILE_KEY, encoder.encode(JSON.stringify(data)), {
        contentType: "application/json",
    });
}

export async function addSaying(saying: string): Promise<void> {
    const sayingList = await downloadJson();
    if (!sayingList) {
        return;
    }

    const newSayingList = modifyJson(sayingList, saying);
    console.log("newSayingList", newSayingList);
    await uploadJson(newSayingList);
}
