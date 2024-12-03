// sayingManager.ts

import { promises as fs } from "node:fs";

const FILE_PATH = "./sayingList.json";

// 名言リストを取得
export async function getSayingList(): Promise<string[]> {
    try {
        const data = await fs.readFile(FILE_PATH, "utf-8");
        return JSON.parse(data);
    } catch (error) {
        if (isNodeJsErrnoException(error) && error.code === "ENOENT") {
            return [];
        }
        throw error;
    }
}

// 名言を追加
export async function addSaying(saying: string): Promise<void> {
    const sayings = await getSayingList();
    sayings.push(saying);
    await fs.writeFile(FILE_PATH, JSON.stringify(sayings, null, 2), "utf-8");
}

// NodeJS.ErrnoException型の型ガード
function isNodeJsErrnoException(error: unknown): error is NodeJS.ErrnoException {
    return (error as NodeJS.ErrnoException).code !== undefined;
}
