import json
import uuid
import random
import string
import datetime
import time
import pytz
import asyncio
import tls_client
import discord
from discord.ext import commands

COURSE_ID = "DUOLINGO_FR_EN"
FROM_LANGUAGE = "en"
LEARN_LANGUAGE = "fr"
TIMEZONE = "Asia/Saigon"
NAME = "User"
DUO_VERSION = "6.73.3"
MAX_THREADS = 5

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="/", intents=intents)

def random_username(length: int = 10) -> str:
    chars = string.ascii_lowercase + string.digits
    return random.choice(string.ascii_lowercase) + ''.join(random.choices(chars, k=length - 1))

def random_password(length: int = 12) -> str:
    chars = string.ascii_letters + string.digits + "!@#$%"
    return ''.join(random.choices(chars, k=length))

def random_email(username: str) -> str:
    domains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "protonmail.com"]
    suffix = ''.join(random.choices(string.digits, k=4))
    return f"{username}{suffix}@{random.choice(domains)}"

def random_mobile_ua() -> str:
    android = random.randint(13, 15)
    devices = ["Pixel 7", "Pixel 8", "SM-S918B", "SM-G998B", "sdk_gphone64_x86_64"]
    builds = ["TQ3A", "TP1A", "SP2A", "UP1A"]
    date = random.randint(220101, 240806)
    suffix = random.randint(1, 999)
    return (f"Duodroid/{DUO_VERSION} Dalvik/2.1.0 "
            f"(Linux; U; Android {android}; {random.choice(devices)} "
            f"Build/{random.choice(builds)}.{date}.{suffix:03d})")

def random_web_ua() -> str:
    chrome = random.randint(118, 131)
    return (f"Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            f"AppleWebKit/537.36 (KHTML, like Gecko) "
            f"Chrome/{chrome}.0.0.0 Safari/537.36")

def create_account(index: int, total: int) -> dict:
    android_s = tls_client.Session("okhttp4_android_13", random_tls_extension_order=True)
    android_s.headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "host": "android-api-cf.duolingo.com",
        "user-agent": random_mobile_ua(),
        "x-amzn-trace-id": "User=0",
    }
    r = android_s.post(
        "https://android-api-cf.duolingo.com/2023-05-23/users",
        params={"fields": "id,creationDate,fromLanguage,courses,currentCourseId,username,health,zhTw,hasPlus,joinedClassroomIds,observedClassroomIds,roles"},
        json={
            "currentCourseId": COURSE_ID,
            "distinctId": str(uuid.uuid4()),
            "fromLanguage": FROM_LANGUAGE,
            "timezone": TIMEZONE,
            "zhTw": False,
        },
    )
    if r.status_code == 500:
        raise Exception(f"Step 1 HTTP 500 — update DUO_VERSION (current: {DUO_VERSION})")
    if r.status_code != 200:
        raise Exception(f"Step 1 failed: HTTP {r.status_code} — {r.text[:200]}")

    data = r.json()
    duo_id = data["id"]
    jwt = r.headers.get("Jwt") or r.headers.get("jwt")
    if not jwt:
        raise Exception("Cannot get JWT from response headers")

    username = random_username()
    password = random_password()
    email = random_email(username)

    android_s.headers.update({
        "authorization": f"Bearer {jwt}",
        "x-amzn-trace-id": f"User={duo_id}",
    })
    r = android_s.post(
        "https://android-api-cf.duolingo.com/2017-06-30/batch",
        params={"fields": "responses{body,status,headers}"},
        json={
            "requests": [{
                "body": json.dumps({
                    "age": str(random.randint(18, 40)),
                    "distinctId": f"UserId(id={duo_id})",
                    "email": email,
                    "emailPromotion": True,
                    "name": NAME,
                    "firstName": NAME,
                    "lastName": NAME,
                    "username": username,
                    "password": password,
                    "pushPromotion": True,
                    "timezone": TIMEZONE,
                }),
                "bodyContentType": "application/json",
                "method": "PATCH",
                "url": f"/2023-05-23/users/{duo_id}?fields=id,email,name",
                "origin": "https://android-api-cf.duolingo.com",
            }],
            "includeHeaders": False,
        },
    )
    if r.status_code != 200:
        raise Exception(f"Step 2 failed: HTTP {r.status_code} — {r.text[:200]}")

    time.sleep(1)

    web = tls_client.Session("chrome_120", random_tls_extension_order=True)
    lesson_hdrs = {
        "authorization": f"Bearer {jwt}",
        "content-type": "application/json",
        "user-agent": random_web_ua(),
        "origin": "https://stories.duolingo.com",
        "referer": "https://www.duolingo.com/lesson",
    }

    tz = pytz.timezone(TIMEZONE)
    now = datetime.datetime.now(tz).timestamp()

    r = web.post(
        "https://stories.duolingo.com/api2/stories/fr-en-le-passeport/complete",
        headers=lesson_hdrs,
        json={
            "awardXp": True,
            "completedBonusChallenge": True,
            "fromLanguage": "fr",
            "learningLanguage": "en",
            "hasXpBoost": False,
            "illustrationFormat": "svg",
            "isFeaturedStoryInPracticeHub": True,
            "isLegendaryMode": True,
            "isV2Redo": False,
            "isV2Story": False,
            "masterVersion": True,
            "maxScore": 0,
            "score": 0,
            "happyHourBonusXp": 469,
            "startTime": now,
            "endTime": now + random.randint(300, 420),
        },
    )
    xp_ok = r.status_code == 200
    if not xp_ok:
        pass

    return {
        "id": duo_id,
        "username": username,
        "email": email,
        "password": password,
        "jwt": jwt,
        "xp_boost": xp_ok,
    }

async def worker(index: int, total: int) -> tuple[int, dict | None, str | None]:
    loop = asyncio.get_event_loop()
    try:
        acc = await loop.run_in_executor(None, create_account, index, total)
        return (index, acc, None)
    except Exception as e:
        return (index, None, str(e))

@bot.event
async def on_ready():
    print(f"Bot logged in as {bot.user}")

@bot.command(name="create")
async def create(ctx, count: int = 1):
    if count < 1:
        count = 1
    if count > 10:
        count = 10

    await ctx.send(f"🔄 Creating {count} account(s)...")

    success = 0
    failed = 0
    results = []
    start_time = time.time()

    tasks = [worker(i + 1, count) for i in range(count)]
    for coro in asyncio.as_completed(tasks):
        idx, acc, err = await coro
        results.append((idx, acc, err))

        if acc:
            success += 1
            embed = discord.Embed(
                title=f"✅ Account {idx} Created",
                color=discord.Color.green(),
            )
            embed.add_field(name="Username", value=acc["username"], inline=False)
            embed.add_field(name="Email", value=acc["email"], inline=False)
            embed.add_field(name="Password", value=f"||{acc['password']}||", inline=False)
            embed.add_field(name="ID", value=acc["id"], inline=False)
            embed.add_field(name="XP Boost", value="✓ 499 XP" if acc["xp_boost"] else "✗ Failed", inline=False)
            await ctx.send(embed=embed)
        else:
            failed += 1
            await ctx.send(f"❌ Account {idx} failed: {err}")

    elapsed = time.time() - start_time
    embed = discord.Embed(
        title="Generation Complete",
        color=discord.Color.blue(),
    )
    embed.add_field(name="✅ Success", value=f"{success}/{count}", inline=True)
    embed.add_field(name="❌ Failed", value=f"{failed}/{count}", inline=True)
    embed.add_field(name="⏱ Time", value=f"{elapsed:.1f}s", inline=True)
    await ctx.send(embed=embed)

bot.run("YOUR_DISCORD_TOKEN")
