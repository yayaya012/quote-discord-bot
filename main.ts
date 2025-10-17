import {
    createBot,
    getBotIdFromToken,
    startBot,
    Intents,
    CreateSlashApplicationCommand,
    Bot,
    Interaction,
    InteractionResponseTypes,
    ApplicationCommandOptionTypes,
} from "@discordeno/mod.ts";
import { addSaying, downloadJson, getImage, saveSayingList } from "./sayingManager.ts";

interface SlashCommand {
    info: CreateSlashApplicationCommand;
    response(bot: Bot, interaction: Interaction): Promise<void>;
}

const botToken: string = Deno.env.get("BOT_TOKEN")!;
const channelId: string = Deno.env.get("CHANNEL_ID")!;
const botId = getBotIdFromToken(botToken);

Deno.cron("Continuous Request", "*/2 * * * *", () => {
    console.log("running...");
});

Deno.cron("send saying schedule", "0 3 * * SUN,MON,WED,FRI", async () => {
    const list = await downloadJson();
    if (!list?.items?.length) return;

    // まず全アイテムの coolDown をデクリメント（0未満にならない）
    for (const it of list.items) {
        if (typeof it.coolDown !== "number") it.coolDown = 0;
        if (it.coolDown > 0) it.coolDown = Math.max(0, it.coolDown - 1);
    }

    // 抽選対象を抽出
    let candidates = list.items.filter((it) => (it.coolDown ?? 0) === 0);

    // もし候補が無ければもう一度デクリメントして回復を試みる
    if (candidates.length === 0) {
        for (const it of list.items) {
            if ((it.coolDown ?? 0) > 0) it.coolDown = Math.max(0, (it.coolDown || 0) - 1);
        }
        candidates = list.items.filter((it) => (it.coolDown ?? 0) === 0);
    }

    // それでも無ければ全件開放（安全弁）
    if (candidates.length === 0) {
        for (const it of list.items) it.coolDown = 0;
        candidates = list.items;
    }

    const random = Math.floor(Math.random() * candidates.length);
    const item = candidates[random];

    // 投稿処理（早期returnしない）
    let sent = false;
    if (!item.imageKey) {
        await bot.helpers.sendMessage(channelId, { content: item.text });
        sent = true;
    } else {
        const obj = await getImage(item.imageKey);
        if (!obj?.body) {
            await bot.helpers.sendMessage(channelId, { content: item.text });
            sent = true;
        } else {
            const bytes = new Uint8Array(await new Response(obj.body).arrayBuffer());
            await bot.helpers.sendMessage(channelId, {
                content: item.text,
                file: [{ name: item.imageKey.split("/").pop() ?? "image", blob: new Blob([bytes]) }],
            });
            sent = true;
        }
    }

    if (sent) {
        item.coolDown = 3;
        await saveSayingList(list);
    }
});

// １分ごとに送信するテスト(push禁止)
// Deno.cron("debug send saying every minute", "* * * * *", async () => {
//     const list = await downloadJson();
//     if (!list?.items?.length) return;

//     const random = Math.floor(Math.random() * list.items.length);
//     const item = list.items[random];

//     if (!item.imageKey) {
//         await bot.helpers.sendMessage(channelId, { content: item.text });
//         return;
//     }

//     const obj = await getImage(item.imageKey);
//     if (!obj?.body) {
//         await bot.helpers.sendMessage(channelId, { content: item.text });
//         return;
//     }

//     const bytes = new Uint8Array(await new Response(obj.body).arrayBuffer());
//     await bot.helpers.sendMessage(channelId, {
//         content: item.text,
//         file: [{ name: item.imageKey.split("/").pop() ?? "image", blob: new Blob([bytes]) }],
//     });
// });

async function sendSayingOnce() {
    const list = await downloadJson();
    if (!list?.items?.length) {
        return;
    }

    console.log("[sendSayingOnce] length:", list.items.length);
    console.log("[sendSayingOnce] 0:", list.items[0]);
    console.log("[sendSayingOnce] last:", list.items[list.items.length - 1]);
}

const addCommand: SlashCommand = {
    info: {
        name: "add_saying",
        description: "名言を追加します",
        options: [
            {
                type: ApplicationCommandOptionTypes.String,
                name: "text",
                description: "追加する名言",
                required: true,
            },
            {
                type: ApplicationCommandOptionTypes.Attachment,
                name: "image",
                description: "画像ファイル（任意）",
                required: false,
            },
        ],
    },

    response: async (bot, interaction) => {
        const raw =
            interaction.data?.options?.find((o) => o.name === "text")?.value ??
            interaction.data?.options?.find((o) => o.name === "saying")?.value ??
            "";
        const text = String(raw).trim();
        if (!text) {
            await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
                type: InteractionResponseTypes.ChannelMessageWithSource,
                data: { content: `名言が指定されていません。`, flags: 1 << 6 },
            });
            return;
        }

        const attachId = interaction.data?.options?.find((o) => o.name === "image")?.value?.toString();

        type AttachmentLike = { url: string; filename: string; content_type?: string };

        function isMapLike<T>(x: unknown): x is { get: (k: bigint) => T | undefined; keys?: () => Iterable<bigint> } {
            return typeof x === "object" && x !== null && typeof (x as { get?: unknown }).get === "function";
        }
        function isDictLike<T>(x: unknown): x is Record<string, T> {
            return typeof x === "object" && x !== null && !isMapLike<T>(x);
        }

        const resolved = (interaction.data as { resolved?: { attachments?: unknown } } | undefined)?.resolved;
        const atts = resolved?.attachments;

        let attachment: AttachmentLike | undefined;
        if (attachId && atts) {
            if (isMapLike<AttachmentLike>(atts)) {
                attachment = atts.get(BigInt(attachId));
            } else if (isDictLike<AttachmentLike>(atts)) {
                attachment = atts[attachId];
            }
        }

        if (!attachment) {
            await addSaying(text);
        } else {
            const res = await fetch(attachment.url);
            const buf = new Uint8Array(await res.arrayBuffer());
            await addSaying(text, {
                bytes: buf,
                filename: attachment.filename,
                contentType: res.headers.get("content-type") ?? attachment.content_type ?? undefined,
            });
        }

        try {
            await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
                type: InteractionResponseTypes.ChannelMessageWithSource,
                data: { content: `新しい名言が追加されました: ${text}`, flags: 1 << 6 },
            });
        } catch (e) {
            console.error(`sendInteractionResponse failed`, e);
        }
    },
};

const registeredCountCommand: SlashCommand = {
    info: {
        name: "registered_count",
        description: "登録済みの名言の数を応答します",
    },
    response: async (bot, interaction) => {
        const list = await downloadJson();
        const count = list?.items?.length ?? 0;

        return await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
            type: InteractionResponseTypes.ChannelMessageWithSource,
            data: {
                content: list ? `${count}件の名言が登録されています` : "名言が登録されていません",
                flags: 1 << 6,
            },
        });
    },
};

// ボットの作成
const bot = createBot({
    token: botToken,
    botId: botId as bigint,
    intents: Intents.Guilds | Intents.GuildMessages,
    events: {
        ready: async (_bot, payload) => {
            console.log(`${payload.user.username} is ready!`);
            if (Deno.args.includes("--run-once")) {
                await sendSayingOnce();
            }
        },
        interactionCreate: async (_bot, interaction) => {
            if (!interaction.data?.name) return;

            switch (interaction.data.name) {
                case addCommand.info.name:
                    await addCommand.response(bot, interaction);
                    break;
                case registeredCountCommand.info.name:
                    await registeredCountCommand.response(bot, interaction);
                    break;
                default:
                    console.log(`Unknown command: ${interaction.data.name}`);
                    break;
            }
        },
    },
});

// コマンドの作成
bot.helpers.createGlobalApplicationCommand(addCommand.info);
bot.helpers.createGlobalApplicationCommand(registeredCountCommand.info);

// コマンドの登録
bot.helpers.upsertGlobalApplicationCommands([addCommand.info, registeredCountCommand.info]);

await startBot(bot);
