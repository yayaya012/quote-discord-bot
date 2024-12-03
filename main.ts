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
import { addSaying } from "./sayingManager.ts";

interface SlashCommand {
    info: CreateSlashApplicationCommand;
    response(bot: Bot, interaction: Interaction): Promise<void>;
}

const botToken: string = Deno.env.get("BOT_TOKEN")!;
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
            await addSaying(saying.toString());
            return await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
                type: InteractionResponseTypes.ChannelMessageWithSource,
                data: {
                    content: `新しい名言が追加されました: "${saying}"`,
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
            await addCommand.response(bot, interaction);
        },
    },
});

// コマンドの作成
bot.helpers.createGlobalApplicationCommand(addCommand.info);

// コマンドの登録
bot.helpers.upsertGlobalApplicationCommands([addCommand.info]);

await startBot(bot);
