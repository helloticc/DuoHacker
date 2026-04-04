import crypto from "crypto";
import https from "https";
import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";

const COURSE_ID = "DUOLINGO_FR_EN";
const FROM_LANGUAGE = "en";
const LEARN_LANGUAGE = "fr";
const TIMEZONE = "Asia/Saigon";
const NAME = "User";
const DUO_VERSION = "6.73.3";
const MAX_THREADS = 5;
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function randomString(length, chars = "abcdefghijklmnopqrstuvwxyz0123456789") {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function randomUsername(length = 10) {
  const first = randomString(1, "abcdefghijklmnopqrstuvwxyz");
  return first + randomString(length - 1, "abcdefghijklmnopqrstuvwxyz0123456789");
}

function randomPassword(length = 12) {
  return randomString(length, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%");
}

function randomEmail(username) {
  const domains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "protonmail.com"];
  const suffix = randomString(4, "0123456789");
  const domain = domains[Math.floor(Math.random() * domains.length)];
  return `${username}${suffix}@${domain}`;
}

function randomMobileUA() {
  const android = Math.floor(Math.random() * 3) + 13;
  const devices = ["Pixel 7", "Pixel 8", "SM-S918B", "SM-G998B", "sdk_gphone64_x86_64"];
  const builds = ["TQ3A", "TP1A", "SP2A", "UP1A"];
  const date = Math.floor(Math.random() * (240806 - 220101)) + 220101;
  const suffix = Math.floor(Math.random() * 999) + 1;
  const device = devices[Math.floor(Math.random() * devices.length)];
  const build = builds[Math.floor(Math.random() * builds.length)];
  return `Duodroid/${DUO_VERSION} Dalvik/2.1.0 (Linux; U; Android ${android}; ${device} Build/${build}.${date}.${suffix.toString().padStart(3, "0")})`;
}

function randomWebUA() {
  const chrome = Math.floor(Math.random() * 14) + 118;
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chrome}.0.0.0 Safari/537.36`;
}

function httpRequest(method, hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      hostname,
      path,
      headers,
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function createAccount(index, total) {
  const createHeaders = {
    accept: "application/json",
    "content-type": "application/json",
    host: "android-api-cf.duolingo.com",
    "user-agent": randomMobileUA(),
    "x-amzn-trace-id": "User=0",
  };

  const createBody = JSON.stringify({
    currentCourseId: COURSE_ID,
    distinctId: crypto.randomUUID(),
    fromLanguage: FROM_LANGUAGE,
    timezone: TIMEZONE,
    zhTw: false,
  });

  const createRes = await httpRequest(
    "POST",
    "android-api-cf.duolingo.com",
    "/2023-05-23/users?fields=id,creationDate,fromLanguage,courses,currentCourseId,username,health,zhTw,hasPlus,joinedClassroomIds,observedClassroomIds,roles",
    createHeaders,
    createBody
  );

  if (createRes.status === 500) {
    throw new Error(`Step 1 HTTP 500 — update DUO_VERSION (current: ${DUO_VERSION})`);
  }
  if (createRes.status !== 200) {
    throw new Error(`Step 1 failed: HTTP ${createRes.status} — ${createRes.body.substring(0, 200)}`);
  }

  const data = JSON.parse(createRes.body);
  const duoId = data.id;
  const jwt = createRes.headers.jwt || createRes.headers["jwt"];

  if (!jwt) {
    throw new Error("Cannot get JWT from response headers");
  }

  const username = randomUsername();
  const password = randomPassword();
  const email = randomEmail(username);

  const claimHeaders = {
    ...createHeaders,
    authorization: `Bearer ${jwt}`,
    "x-amzn-trace-id": `User=${duoId}`,
  };

  const claimBody = JSON.stringify({
    requests: [
      {
        body: JSON.stringify({
          age: String(Math.floor(Math.random() * 23) + 18),
          distinctId: `UserId(id=${duoId})`,
          email,
          emailPromotion: true,
          name: NAME,
          firstName: NAME,
          lastName: NAME,
          username,
          password,
          pushPromotion: true,
          timezone: TIMEZONE,
        }),
        bodyContentType: "application/json",
        method: "PATCH",
        url: `/2023-05-23/users/${duoId}?fields=id,email,name`,
        origin: "https://android-api-cf.duolingo.com",
      },
    ],
    includeHeaders: false,
  });

  const claimRes = await httpRequest(
    "POST",
    "android-api-cf.duolingo.com",
    "/2017-06-30/batch?fields=responses{body,status,headers}",
    claimHeaders,
    claimBody
  );

  if (claimRes.status !== 200) {
    throw new Error(`Step 2 failed: HTTP ${claimRes.status} — ${claimRes.body.substring(0, 200)}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));

  const storyHeaders = {
    authorization: `Bearer ${jwt}`,
    "content-type": "application/json",
    "user-agent": randomWebUA(),
    origin: "https://stories.duolingo.com",
    referer: "https://www.duolingo.com/lesson",
  };

  const now = Math.floor(Date.now() / 1000);
  const storyBody = JSON.stringify({
    awardXp: true,
    completedBonusChallenge: true,
    fromLanguage: "fr",
    learningLanguage: "en",
    hasXpBoost: false,
    illustrationFormat: "svg",
    isFeaturedStoryInPracticeHub: true,
    isLegendaryMode: true,
    isV2Redo: false,
    isV2Story: false,
    masterVersion: true,
    maxScore: 0,
    score: 0,
    happyHourBonusXp: 469,
    startTime: now,
    endTime: now + Math.floor(Math.random() * 120) + 300,
  });

  const storyRes = await httpRequest(
    "POST",
    "stories.duolingo.com",
    "/api2/stories/fr-en-le-passeport/complete",
    storyHeaders,
    storyBody
  );

  const xpOk = storyRes.status === 200;

  return {
    id: duoId,
    username,
    email,
    password,
    jwt,
    xpBoost: xpOk,
  };
}

async function worker(index, total) {
  try {
    const acc = await createAccount(index, total);
    return { index, acc, err: null };
  } catch (e) {
    return { index, acc: null, err: String(e) };
  }
}

client.on("ready", () => {
  console.log(`Bot logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "create") {
    let count = interaction.options.getInteger("count") || 1;
    if (count < 1) count = 1;
    if (count > 10) count = 10;

    await interaction.reply(`🔄 Creating ${count} account(s)...`);

    let success = 0;
    let failed = 0;
    const startTime = Date.now();

    const tasks = [];
    for (let i = 1; i <= count; i++) {
      tasks.push(worker(i, count));
    }

    for (const promise of tasks) {
      const { index, acc, err } = await promise;

      if (acc) {
        success++;
        const embed = new EmbedBuilder()
          .setTitle(`✅ Account ${index} Created`)
          .setColor(0x00ff00)
          .addFields(
            { name: "Username", value: acc.username, inline: false },
            { name: "Email", value: acc.email, inline: false },
            { name: "Password", value: `||${acc.password}||`, inline: false },
            { name: "ID", value: acc.id, inline: false },
            { name: "XP Boost", value: acc.xpBoost ? "✓ 499 XP" : "✗ Failed", inline: false }
          );
        await interaction.followUp({ embeds: [embed] });
      } else {
        failed++;
        await interaction.followUp(`❌ Account ${index} failed: ${err}`);
      }
    }

    const elapsed = (Date.now() - startTime) / 1000;
    const resultEmbed = new EmbedBuilder()
      .setTitle("Generation Complete")
      .setColor(0x0099ff)
      .addFields(
        { name: "✅ Success", value: `${success}/${count}`, inline: true },
        { name: "❌ Failed", value: `${failed}/${count}`, inline: true },
        { name: "⏱ Time", value: `${elapsed.toFixed(1)}s`, inline: true }
      );
    await interaction.followUp({ embeds: [resultEmbed] });
  }
});

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    const commands = [
      {
        name: "create",
        description: "Create Duolingo accounts",
        options: [
          {
            name: "count",
            type: 4,
            description: "Number of accounts to create (1-10)",
            required: false,
          },
        ],
      },
    ];

    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });

    console.log("Commands registered");
  } catch (error) {
    console.error("Error registering commands:", error);
  }
})();

client.login(TOKEN);
