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
import { addSaying, downloadJson } from "./sayingManager.ts";

interface SlashCommand {
    info: CreateSlashApplicationCommand;
    response(bot: Bot, interaction: Interaction): Promise<void>;
}

const botToken: string = Deno.env.get("BOT_TOKEN")!;
const channelId: string = Deno.env.get("CHANNEL_ID")!;
const botId = getBotIdFromToken(botToken);

const addCommand: SlashCommand = {
    info: {
        name: "add_saying",
        description: "名言を追加します",
        options: [
            {
                type: ApplicationCommandOptionTypes.String,
                name: "saying",
                description: "追加する名言",
                required: true,
            },
        ],
    },
    response: async (bot, interaction) => {
        const saying = interaction.data?.options?.find((option) => option.name === "saying")?.value;
        if (saying) {
            // ここで、ローカル(またはデプロイURL)へ HTTP リクエストを飛ばす
            // 例: "https://<your-deno-deploy>.deno.dev/add-saying"
            const targetUrl = `${Deno.env.get("BASE_URL")!}/add-saying?text=${encodeURIComponent(saying.toString())}`;

            try {
                // Slash Command中で fetch してもOK
                await fetch(targetUrl, { method: "GET" });
                console.log("Dispatched /add-saying request in background");
            } catch (err) {
                console.error("Failed to dispatch /add-saying request:", err);
            }

            // Slash Commandへの応答はすぐ返す
            return await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
                type: InteractionResponseTypes.ChannelMessageWithSource,
                data: {
                    content: `新しい名言を追加しました（バックグラウンド処理中）: ${saying}`,
                    flags: 1 << 6,
                },
            });
        }

        return await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
            type: InteractionResponseTypes.ChannelMessageWithSource,
            data: {
                content: "名言が指定されていません。",
                flags: 1 << 6,
            },
        });
    },
};

const registeredCountCommand: SlashCommand = {
    info: {
        name: "registered_count",
        description: "登録済みの名言の数を応答します",
    },
    response: async (bot, interaction) => {
        const sayingList = await downloadJson();

        return await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
            type: InteractionResponseTypes.ChannelMessageWithSource,
            data: {
                content: sayingList ? `${sayingList.length}件の名言が登録されています` : "名言が登録されていません",
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
        ready: (_bot, payload) => {
            console.log(`${payload.user.username} is ready!`);
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

Deno.cron("Continuous Request", "*/2 * * * *", () => {
    console.log("running...");
});

Deno.cron("send saying schedule", "0 3 * * SUN,MON,WED,FRI", async () => {
    const sayingList = await downloadJson();
    if (!sayingList) {
        return undefined;
    }

    const random = Math.floor(Math.random() * (sayingList.length - 0));
    bot.helpers.sendMessage(channelId, { content: sayingList.saying[random] });
});

// ============================
// fetchイベントで waitUntil
// ============================
addEventListener("fetch", (event: FetchEvent) => {
    event.respondWith(handleFetch(event));
});

/**
 * /add-saying?text=... というHTTPアクセスがあったときに
 * レスポンス返却後も S3アップロードを裏で続けたい例
 */
async function handleFetch(event: FetchEvent): Promise<Response> {
    const url = new URL(event.request.url);

    // 例: /add-saying?text=XXX
    if (url.pathname === "/add-saying") {
        const text = url.searchParams.get("text") || "Default saying";

        // レスポンスはすぐ返す
        const response = new Response(`OK! We'll add saying: ${text}`, { status: 200 });

        // レスポンス返却後も続行したい処理を waitUntil
        event.waitUntil(
            (async () => {
                await addSaying(text);
                console.log("Finished addSaying in the background");
            })()
        );

        return await Promise.resolve(response);
    }

    // デフォルト応答
    return new Response("Hello from Deno Deploy + Discordeno + waitUntil!", {
        status: 200,
        headers: { "content-type": "text/plain" },
    });
}
