# Base on DuoXPy's Dex , big thanks to them!

import discord
from discord import app_commands
from discord.ext import commands
import asyncio
import json
import base64
import uuid
import aiohttp
import time
import datetime
import os
import random
import pytz
import secrets
import string
from urllib.parse import quote
from aiohttp_socks import ProxyConnector, ProxyConnectionError
from dotenv import load_dotenv
from typing import Optional, Dict, Any, List

load_dotenv()

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents)

NAME = "www.twisk.fun"

class AccountStatus:
    PENDING = "pending"
    CREATING = "creating"
    SUCCESS = "success"
    FAILED = "failed"
    RETRYING = "retrying"
    RATE_LIMITED = "rate_limited"

class AccountProgress:
    def __init__(self, account_id: int):
        self.account_id = account_id
        self.status = AccountStatus.PENDING
        self.progress = 0
        self.message = "Waiting to start..."
        self.start_time = None
        self.end_time = None
        self.retry_count = 0
        self.rate_limit_until = None
        self.account_data = None
        self.error_message = None
        self.proxy_used = "Direct"
        self.connection_type = "Direct"
        self.fallback_count = 0

def load_proxies():
    proxies = []
    try:
        if os.path.exists("proxies.txt"):
            with open("proxies.txt", "r") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#"):
                        proxies.append(line)
    except Exception as e:
        print(f"Error loading proxies: {e}")
    return proxies

class TempMail:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = "https://api.tempmail.lol"

    async def create_inbox(self, domain=None, prefix=None):
        headers = {
            "Content-Type": "application/json"
        }
        data = {
            "apikey": self.api_key,
            "domain": domain,
            "prefix": prefix
        }
        
        async with await get_session(direct=True) as session:
            async with session.post(f"{self.base_url}/v2/inbox/create", headers=headers, json=data) as response:
                response.raise_for_status()
                try:
                    return await response.json()
                except ValueError:
                    raise Exception("Invalid JSON response from TempMail API")

    async def get_emails(self, inbox):
        params = {
            "apikey": self.api_key,
            "token": inbox["token"]
        }
        
        async with await get_session(direct=True) as session:
            async with session.get(f"{self.base_url}/v2/inbox", params=params) as response:
                response.raise_for_status()
                try:
                    data = await response.json()
                    emails = data["emails"]
                    return emails
                except ValueError:
                    raise Exception("Invalid JSON response from TempMail API")

class Miscellaneous:
    def randomize_mobile_user_agent(self) -> str:
        duolingo_version = "6.26.2"
        android_version = random.randint(12, 15)
        build_codes = ['AE3A', 'TQ3A', 'TP1A', 'SP2A', 'UP1A', 'RQ3A', 'RD2A', 'SD2A']
        build_date = f"{random.randint(220101, 240806)}"
        build_suffix = f"{random.randint(1, 999):03d}"
        
        devices = [
            'sdk_gphone64_x86_64',
            'Pixel 6',
            'Pixel 6 Pro',
            'Pixel 7',
            'Pixel 7 Pro', 
            'Pixel 8',
            'SM-A536B',
            'SM-S918B',
            'SM-G998B',
            'SM-N986B',
            'OnePlus 9 Pro',
            'OnePlus 10 Pro',
            'M2102J20SG',
            'M2012K11AG'
        ]
        
        device = random.choice(devices)
        build_code = random.choice(build_codes)
        
        user_agent = f"Duodroid/{duolingo_version} Dalvik/2.1.0 (Linux; U; Android {android_version}; {device} Build/{build_code}.{build_date}.{build_suffix})"
        return user_agent

    def randomize_computer_user_agent(self) -> str:
        platforms = [
            "Windows NT 10.0; Win64; x64",
            "Windows NT 10.0; WOW64",
            "Macintosh; Intel Mac OS X 10_15_7",
            "Macintosh; Intel Mac OS X 11_2_3",
            "X11; Linux x86_64",
            "X11; Linux i686",
            "X11; Ubuntu; Linux x86_64",
        ]
        
        browsers = [
            ("Chrome", f"{random.randint(90, 140)}.0.{random.randint(1000, 4999)}.0"),
            ("Firefox", f"{random.randint(80, 115)}.0"),
            ("Safari", f"{random.randint(13, 16)}.{random.randint(0, 3)}"),
            ("Edge", f"{random.randint(90, 140)}.0.{random.randint(1000, 4999)}.0"),
        ]
        
        webkit_version = f"{random.randint(500, 600)}.{random.randint(0, 99)}"
        platform = random.choice(platforms)
        browser_name, browser_version = random.choice(browsers)
        
        if browser_name == "Safari":
            user_agent = (
                f"Mozilla/5.0 ({platform}) AppleWebKit/{webkit_version} (KHTML, like Gecko) "
                f"Version/{browser_version} Safari/{webkit_version}"
            )
        elif browser_name == "Firefox":
            user_agent = f"Mozilla/5.0 ({platform}; rv:{browser_version}) Gecko/20100101 Firefox/{browser_version}"
        else:
            user_agent = (
                f"Mozilla/5.0 ({platform}) AppleWebKit/{webkit_version} (KHTML, like Gecko) "
                f"{browser_name}/{browser_version} Safari/{webkit_version}"
            )
        
        return user_agent

async def get_session(slot: Optional[int] = None, direct: bool = False, proxies: List[str] = None, progress: AccountProgress = None):
    if direct:
        import ssl
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        
        connector = aiohttp.TCPConnector(force_close=True, ssl=ssl_context)
        timeout = aiohttp.ClientTimeout(total=600, connect=600, sock_read=600, sock_connect=600)
        return aiohttp.ClientSession(connector=connector, timeout=timeout)

    if proxies and slot is not None and progress and progress.connection_type == "Proxy":
        proxy_index = slot % len(proxies)
        proxy = proxies[proxy_index]
        
        try:
            connector = ProxyConnector.from_url(proxy, force_close=True)
            timeout = aiohttp.ClientTimeout(total=600, connect=600, sock_read=600, sock_connect=600)
            session = aiohttp.ClientSession(connector=connector, timeout=timeout)
            
            try:
                async with session.get("https://www.duolingo.com", timeout=aiohttp.ClientTimeout(total=10)) as response:
                    if response.status == 200:
                        if progress:
                            progress.proxy_used = f"Proxy {proxy_index + 1}"
                            progress.connection_type = "Proxy"
                        return session
            except Exception as e:
                await session.close()
                raise e
                
        except Exception as e:
            if progress:
                progress.fallback_count += 1
                progress.message = f"Proxy {proxy_index + 1} failed, trying direct..."
            await session.close()
    
    if progress:
        progress.proxy_used = "Direct"
        progress.connection_type = "Direct"
        if progress.fallback_count > 0:
            progress.message = f"Using direct connection (proxy failed)"
    
    import ssl
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    
    connector = aiohttp.TCPConnector(force_close=True, ssl=ssl_context)
    timeout = aiohttp.ClientTimeout(total=600, connect=600, sock_read=600, sock_connect=600)
    return aiohttp.ClientSession(connector=connector, timeout=timeout)

async def getheaders(token: str, userid: str):
    misc = Miscellaneous()
    user_agent = misc.randomize_mobile_user_agent()
    
    headers = {
        "accept": "application/json", 
        "authorization": f"Bearer {token}",
        "connection": "Keep-Alive",
        "content-type": "application/json",
        "cookie": f"jwt_token={token}",
        "origin": "https://www.duolingo.com",
        "user-agent": user_agent,
        "x-amzn-trace-id": f"User={userid}",
    }
    return headers

def generate_random_password(length: int = 12) -> str:
    characters = string.ascii_letters + string.digits + "!@#$%^&*"
    password = ''.join(random.choice(characters) for _ in range(length))
    return password

class DuolingoAccountCreator:
    def __init__(self, proxies: List[str] = None):
        self.misc = Miscellaneous()
        self.tmp = TempMail(os.getenv('TEMPMAIL_API_KEY'))
        self.proxies = proxies or []

    def generate_random_string(self, min_length: int = 4, max_length: int = 16) -> str:
        length = random.randint(min_length, max_length)
        valid_chars = string.ascii_letters + string.digits + "-._"
        username = random.choice(string.ascii_letters)
        username += ''.join(random.choices(valid_chars, k=length-1))
        return username

    async def create_account_with_progress(self, password: str, progress: AccountProgress) -> dict:
        try:
            progress.start_time = datetime.datetime.now()
            progress.status = AccountStatus.CREATING
            progress.progress = 5
            progress.message = "Creating unclaimed account..."
            
            headers = {
                'accept': 'application/json', 
                'connection': 'Keep-Alive',
                'content-type': 'application/json',
                'host': 'android-api-cf.duolingo.com',
                'user-agent': self.misc.randomize_mobile_user_agent(),
                'x-amzn-trace-id': 'User=0'
            }

            params = {
                'fields': 'id,creationDate,fromLanguage,courses,currentCourseId,username,health,zhTw,hasPlus,joinedClassroomIds,observedClassroomIds,roles'
            }

            json_data = {
                'currentCourseId': 'DUOLINGO_FR_EN',
                'distinctId': str(uuid.uuid4()),
                'fromLanguage': 'en',
                'timezone': 'Asia/Saigon',
                'zhTw': False
            }

            proxy_slot = progress.account_id - 1 if self.proxies else None
            use_proxy = bool(self.proxies) and progress.connection_type == "Proxy"
            async with await get_session(slot=proxy_slot, direct=not use_proxy, proxies=self.proxies, progress=progress) as session:
                max_retries = 3
                for attempt in range(max_retries):
                    try:
                        async with session.post(
                            'https://android-api-cf.duolingo.com/2023-05-23/users',
                            params=params,
                            headers=headers,
                            json=json_data
                        ) as response:
                            if response.status == 429:
                                progress.status = AccountStatus.RATE_LIMITED
                                progress.message = f"Rate limited on {progress.connection_type}, retrying..."
                                await asyncio.sleep(5)
                                continue
                            elif response.status != 200:
                                if attempt < max_retries - 1:
                                    progress.status = AccountStatus.RETRYING
                                    progress.message = f"Retrying unclaimed account creation... (Attempt {attempt + 1})"
                                    await asyncio.sleep(2)
                                    continue
                                else:
                                    raise Exception("Failed to create unclaimed account")
                            data = await response.json()
                            duo_id = data.get("id")
                            jwt = response.headers.get("Jwt")
                            if not duo_id or not jwt:
                                raise Exception("Failed to get duo_id or jwt")
                            progress.progress = 15
                            progress.message = f"Unclaimed account created - ID: {duo_id}"
                            break
                    except Exception as e:
                        if "rate limit" in str(e).lower() or "429" in str(e):
                            progress.status = AccountStatus.RATE_LIMITED
                            progress.message = f"Rate limited, switching connection..."
                            await asyncio.sleep(5)
                            if self.proxies and progress.connection_type == "Proxy":
                                progress.fallback_count += 1
                                progress.message = "Switching to direct connection..."
                                await session.close()
                                session = await get_session(direct=True, progress=progress)
                            continue
                        elif attempt < max_retries - 1:
                            progress.status = AccountStatus.RETRYING
                            progress.message = f"Retrying... (Attempt {attempt + 1})"
                            await asyncio.sleep(2)
                            continue
                        else:
                            raise e

                await asyncio.sleep(2)
                progress.progress = 25
                progress.message = "Creating email inbox..."
                username = self.generate_random_string()
                inbox = await self.tmp.create_inbox(None, username)
                if not inbox:
                    raise Exception("Failed to create email inbox")
                email = inbox["address"]
                progress.progress = 35
                progress.message = f"Email inbox created - {email}"

                progress.progress = 45
                progress.message = "Claiming account..."
                headers = await getheaders(jwt, duo_id)
                json_data = {
                    'requests': [{
                        'body': json.dumps({
                            'age': str(random.randint(18, 50)),
                            'distinctId': f"UserId(id={duo_id})",
                            'email': email,
                            'emailPromotion': True,
                            'name': NAME,
                            'firstName': NAME,
                            'lastName': NAME,
                            'username': username,
                            'password': password,
                            'pushPromotion': True,
                            'timezone': 'Asia/Saigon'
                        }),
                        'bodyContentType': 'application/json',
                        'method': 'PATCH',
                        'url': f'/2023-05-23/users/{duo_id}?fields=id,email,name'
                    }]
                }

                async with session.post(
                    'https://android-api-cf.duolingo.com/2017-06-30/batch',
                    params={'fields': 'responses'},
                    headers=headers,
                    json=json_data
                ) as response:
                    if response.status != 200:
                        raise Exception("Failed to claim account")
                progress.progress = 55
                progress.message = "Account claimed successfully"

                await asyncio.sleep(2)
                progress.progress = 65
                progress.message = "Completing initial lesson..."
                session_data = None
                base_url = "https://www.duolingo.com"
                lesson_headers = {
                    "Authorization": f"Bearer {jwt}",
                    "Content-Type": "application/json; charset=UTF-8",
                    "Accept": "application/json; charset=UTF-8",
                    "User-Agent": self.misc.randomize_computer_user_agent(),
                    "Origin": "https://www.duolingo.com",
                    "Referer": "https://www.duolingo.com/lesson"
                }
                url = f"{base_url}/2017-06-30/sessions"
                payload = {
                    "challengeTypes": [
                        "assist", "characterIntro", "characterMatch", "characterPuzzle",
                        "characterSelect", "characterTrace", "characterWrite",
                        "completeReverseTranslation", "definition", "dialogue",
                        "extendedMatch", "extendedListenMatch", "form", "freeResponse",
                        "gapFill", "judge", "listen", "listenComplete", "listenMatch",
                        "match", "name", "listenComprehension", "listenIsolation",
                        "listenSpeak", "listenTap", "orderTapComplete", "partialListen",
                        "partialReverseTranslate", "patternTapComplete", "radioBinary",
                        "radioImageSelect", "radioListenMatch", "radioListenRecognize",
                        "radioSelect", "readComprehension", "reverseAssist", "sameDifferent",
                        "select", "selectPronunciation", "selectTranscription", "svgPuzzle",
                        "syllableTap", "syllableListenTap", "speak", "tapCloze",
                        "tapClozeTable", "tapComplete", "tapCompleteTable", "tapDescribe",
                        "translate", "transliterate", "transliterationAssist", "typeCloze",
                        "typeClozeTable", "typeComplete", "typeCompleteTable", "writeComprehension"
                    ],
                    "fromLanguage": "en",
                    "isFinalLevel": False,
                    "isV2": True,
                    "juicy": True,
                    "learningLanguage": "fr",
                    "shakeToReportEnabled": True,
                    "smartTipsVersion": 2,
                    "isCustomIntroSkill": False,
                    "isGrammarSkill": False,
                    "levelIndex": 0,
                    "pathExperiments": [],
                    "showGrammarSkillSplash": False,
                    "skillId": "fc5f14f4f4d2451e18f3f03725a5d5b1",
                    "type": "LESSON",
                    "levelSessionIndex": 0
                }

                async with session.post(url, json=payload, headers=lesson_headers) as response:
                    if response.status == 200:
                        session_data = await response.json()
                        session_id = session_data.get("id")
                        await asyncio.sleep(2)
                        url = f"{base_url}/2017-06-30/sessions/{session_id}"
                        complete_headers = lesson_headers.copy()
                        complete_headers["Idempotency-Key"] = session_id
                        complete_headers["X-Requested-With"] = "XMLHttpRequest"
                        complete_headers["User"] = str(duo_id)
                        session_data["failed"] = False
                        current_time = datetime.datetime.now(pytz.timezone("Asia/Saigon"))
                        elapsed_time = 45 + (current_time.timestamp() % 15)
                        session_data["trackingProperties"]["sum_time_taken"] = elapsed_time
                        session_data["xpGain"] = 15
                        session_data["trackingProperties"]["xp_gained"] = 15

                        activity_uuid = session_data.get("trackingProperties", {}).get("activity_uuid")
                        if not activity_uuid:
                            activity_uuid = str(uuid.uuid4())
                            session_data["trackingProperties"]["activity_uuid"] = activity_uuid

                        await session.put(url, json=session_data, headers=complete_headers)
                        await asyncio.sleep(2)
                        progress.progress = 75
                        progress.message = "Initial lesson completed"
                    else:
                        raise Exception(f"Failed to complete lesson. Status: {response.status}")

                progress.progress = 85
                progress.message = "Farming XP from stories..."
                for i in range(10):
                    current_time = datetime.datetime.now(pytz.timezone("Asia/Saigon"))
                    url = f'https://stories.duolingo.com/api2/stories/fr-en-le-passeport/complete'
                    dataget = {
                        "awardXp": True,
                        "completedBonusChallenge": True,
                        "fromLanguage": "en",
                        "hasXpBoost": False,
                        "illustrationFormat": "svg",
                        "isFeaturedStoryInPracticeHub": True,
                        "isLegendaryMode": True,
                        "isV2Redo": False,
                        "isV2Story": False,
                        "learningLanguage": "fr",
                        "masterVersion": True,
                        "maxScore": 0,
                        "score": 0,
                        "happyHourBonusXp": random.randint(0, 465),
                        "startTime": current_time.timestamp(),
                        "endTime": datetime.datetime.now(pytz.timezone("Asia/Saigon")).timestamp(),
                    }
                    retry_count = 0
                    while True:
                        async with session.post(url=url, headers=headers, json=dataget) as response:
                            if response.status == 200:
                                await asyncio.sleep(2)
                                break
                            else:
                                retry_count += 1
                                if retry_count < 10:
                                    await asyncio.sleep(60)
                                else:
                                    raise Exception(f"Failed to farm XP after 10 attempts. Status: {response.status}")
                progress.progress = 100
                progress.message = "XP farming completed"
                        
                account_data = {
                    "_id": duo_id,
                    "email": email,
                    "password": password,
                    "jwt_token": jwt,
                    "timezone": "Asia/Saigon", 
                    "username": username
                }

                progress.end_time = datetime.datetime.now()
                progress.status = AccountStatus.SUCCESS
                progress.message = "Account created successfully!"
                progress.account_data = account_data

            return account_data
        except Exception as e:
            progress.end_time = datetime.datetime.now()
            progress.status = AccountStatus.FAILED
            progress.message = f"Failed: {str(e)}"
            progress.error_message = str(e)
            raise Exception(f"Failed to create account: {str(e)}")

@bot.event
async def on_ready():
    print(f"Bot logged in as {bot.user}")
    try:
        synced = await bot.tree.sync()
        print(f"Synced {len(synced)} command(s)")
    except Exception as e:
        print(f"Failed to sync commands: {e}")

@bot.tree.command(name="generate", description="Generate Duolingo accounts")
@app_commands.describe(count="Number of accounts to generate (1-10)", password="Password for accounts (optional)")
async def generate(interaction: discord.Interaction, count: int = 1, password: str = None):
    if count < 1 or count > 10:
        await interaction.response.send_message("Count must be between 1 and 10", ephemeral=True)
        return

    await interaction.response.defer()

    proxies = load_proxies()
    creator = DuolingoAccountCreator(proxies)
    accounts_progress = [AccountProgress(i+1) for i in range(count)]
    successful_accounts = []

    if proxies:
        proxy_accounts = int(count * 0.7)
        for i in range(proxy_accounts, count):
            accounts_progress[i].connection_type = "Direct"
            accounts_progress[i].proxy_used = "Direct"

    embed = discord.Embed(
        title="DuoHacker Generator",
        description=f"Generating {count} account(s)...",
        color=discord.Color.blue()
    )
    embed.add_field(name="Status", value="Starting...", inline=False)
    
    message = await interaction.followup.send(embed=embed)

    tasks = []
    for i in range(count):
        pwd = password if password else generate_random_password()
        task = asyncio.create_task(creator.create_account_with_progress(pwd, accounts_progress[i]))
        tasks.append(task)

    update_interval = 3
    last_update = time.time()

    while not all(task.done() for task in tasks):
        current_time = time.time()
        if current_time - last_update >= update_interval:
            completed = sum(1 for acc in accounts_progress if acc.status == AccountStatus.SUCCESS)
            failed = sum(1 for acc in accounts_progress if acc.status == AccountStatus.FAILED)
            in_progress = sum(1 for acc in accounts_progress if acc.status in [AccountStatus.CREATING, AccountStatus.RETRYING])
            
            status_text = f"Completed: {completed}\nFailed: {failed}\nIn Progress: {in_progress}"
            
            embed = discord.Embed(
                title="DuoHacker Generator",
                description=f"Generating {count} account(s)...",
                color=discord.Color.blue()
            )
            embed.add_field(name="Status", value=status_text, inline=False)
            
            try:
                await message.edit(embed=embed)
            except:
                pass
            
            last_update = current_time
        
        await asyncio.sleep(1)

    for task in asyncio.as_completed(tasks):
        try:
            account_data = await task
            successful_accounts.append(account_data)
        except:
            pass

    completed = sum(1 for acc in accounts_progress if acc.status == AccountStatus.SUCCESS)
    failed = sum(1 for acc in accounts_progress if acc.status == AccountStatus.FAILED)

    embed = discord.Embed(
        title="DuoHacker Generator - Complete",
        description=f"Generation completed",
        color=discord.Color.green() if completed > 0 else discord.Color.red()
    )
    embed.add_field(name="Results", value=f"Success: {completed}\nFailed: {failed}", inline=False)

    if successful_accounts:
        accounts_text = ""
        for acc in successful_accounts[:5]:
            accounts_text += f"Username: {acc['username']}\n"
            accounts_text += f"Email: {acc['email']}\n"
            accounts_text += f"Password: {acc['password']}\n"
            accounts_text += f"ID: {acc['_id']}\n\n"
        
        if len(successful_accounts) > 5:
            accounts_text += f"...and {len(successful_accounts) - 5} more"
        
        embed.add_field(name="Accounts", value=accounts_text[:1024], inline=False)

        json_data = json.dumps(successful_accounts, indent=2)
        file = discord.File(
            fp=io.BytesIO(json_data.encode()),
            filename="accounts.json"
        )
        await message.edit(embed=embed)
        await interaction.followup.send(file=file)
    else:
        await message.edit(embed=embed)

@bot.tree.command(name="proxies", description="Check proxy status")
async def proxies(interaction: discord.Interaction):
    proxies = load_proxies()
    
    embed = discord.Embed(
        title="Proxy Status",
        color=discord.Color.blue()
    )
    
    if proxies:
        embed.description = f"Loaded {len(proxies)} proxy(ies)"
        proxy_list = "\n".join([f"{i+1}. {proxy[:50]}" for i, proxy in enumerate(proxies[:10])])
        if len(proxies) > 10:
            proxy_list += f"\n...and {len(proxies) - 10} more"
        embed.add_field(name="Proxies", value=proxy_list, inline=False)
    else:
        embed.description = "No proxies loaded - using direct connection"
    
    await interaction.response.send_message(embed=embed, ephemeral=True)

import io

if __name__ == "__main__":
    TOKEN = os.getenv("DISCORD_BOT_TOKEN")
    if not TOKEN:
        print("DISCORD_BOT_TOKEN not found in environment variables")
    else:
        bot.run(TOKEN)
