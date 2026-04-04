import json
import uuid
import random
import string
import datetime
import time
import pytz
import tls_client
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

COURSE_ID      = "DUOLINGO_FR_EN"
FROM_LANGUAGE  = "en"
LEARN_LANGUAGE = "fr"
TIMEZONE       = "Asia/Saigon"
NAME           = "User"
DUO_VERSION    = "6.73.3"
MAX_THREADS    = 5

print_lock = threading.Lock()

def log(msg: str):
    with print_lock:
        print(msg)

def random_username(length: int = 10) -> str:
    chars = string.ascii_lowercase + string.digits
    return random.choice(string.ascii_lowercase) + ''.join(random.choices(chars, k=length - 1))

def random_password(length: int = 12) -> str:
    chars = string.ascii_letters + string.digits + "!@#$%"
    return ''.join(random.choices(chars, k=length))

def random_email(username: str) -> str:
    domains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "protonmail.com"]
    suffix  = ''.join(random.choices(string.digits, k=4))
    return f"{username}{suffix}@{random.choice(domains)}"

def random_mobile_ua() -> str:
    android = random.randint(13, 15)
    devices = ["Pixel 7", "Pixel 8", "SM-S918B", "SM-G998B", "sdk_gphone64_x86_64"]
    builds  = ["TQ3A", "TP1A", "SP2A", "UP1A"]
    date    = random.randint(220101, 240806)
    suffix  = random.randint(1, 999)
    return (f"Duodroid/{DUO_VERSION} Dalvik/2.1.0 "
            f"(Linux; U; Android {android}; {random.choice(devices)} "
            f"Build/{random.choice(builds)}.{date}.{suffix:03d})")

def random_web_ua() -> str:
    chrome = random.randint(118, 131)
    return (f"Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            f"AppleWebKit/537.36 (KHTML, like Gecko) "
            f"Chrome/{chrome}.0.0.0 Safari/537.36")

def create_account(index: int, total: int) -> dict:
    prefix = f"[{index}/{total}]"

    # create unclaimed
    log(f"  {prefix} [/] Creating unclaimed account...")
    android_s = tls_client.Session("okhttp4_android_13", random_tls_extension_order=True)
    android_s.headers = {
        "accept":          "application/json",
        "content-type":    "application/json",
        "host":            "android-api-cf.duolingo.com",
        "user-agent":      random_mobile_ua(),
        "x-amzn-trace-id": "User=0",
    }
    r = android_s.post(
        "https://android-api-cf.duolingo.com/2023-05-23/users",
        params={"fields": "id,creationDate,fromLanguage,courses,currentCourseId,username,health,zhTw,hasPlus,joinedClassroomIds,observedClassroomIds,roles"},
        json={
            "currentCourseId": COURSE_ID,
            "distinctId":      str(uuid.uuid4()),
            "fromLanguage":    FROM_LANGUAGE,
            "timezone":        TIMEZONE,
            "zhTw":            False,
        },
    )
    if r.status_code == 500:
        raise Exception(f"Step 1 HTTP 500 — update DUO_VERSION (current: {DUO_VERSION})")
    if r.status_code != 200:
        raise Exception(f"Step 1 failed: HTTP {r.status_code} — {r.text[:200]}")

    data   = r.json()
    duo_id = data["id"]
    jwt    = r.headers.get("Jwt") or r.headers.get("jwt")
    if not jwt:
        raise Exception("Cannot get JWT from response headers")

    # claim
    log(f"  {prefix} [/] Claiming account...")
    username = random_username()
    password = random_password()
    email    = random_email(username)

    android_s.headers.update({
        "authorization":   f"Bearer {jwt}",
        "x-amzn-trace-id": f"User={duo_id}",
    })
    r = android_s.post(
        "https://android-api-cf.duolingo.com/2017-06-30/batch",
        params={"fields": "responses{body,status,headers}"},
        json={
            "requests": [{
                "body": json.dumps({
                    "age":            str(random.randint(18, 40)),
                    "distinctId":     f"UserId(id={duo_id})",
                    "email":          email,
                    "emailPromotion": True,
                    "name":           NAME,
                    "firstName":      NAME,
                    "lastName":       NAME,
                    "username":       username,
                    "password":       password,
                    "pushPromotion":  True,
                    "timezone":       TIMEZONE,
                }),
                "bodyContentType": "application/json",
                "method":          "PATCH",
                "url":             f"/2023-05-23/users/{duo_id}?fields=id,email,name",
                "origin":          "https://android-api-cf.duolingo.com",
            }],
            "includeHeaders": False,
        },
    )
    if r.status_code != 200:
        raise Exception(f"Step 2 failed: HTTP {r.status_code} — {r.text[:200]}")

    time.sleep(1)

    # step 3 : send 449xp api ( you can delete it )
    log(f"  {prefix} [/] Story XP boost (fr-en-le-passeport)...")
    web = tls_client.Session("chrome_120", random_tls_extension_order=True)
    lesson_hdrs = {
        "authorization": f"Bearer {jwt}",
        "content-type":  "application/json",
        "user-agent":    random_web_ua(),
        "origin":        "https://www.duolingo.com",
        "referer":       "https://www.duolingo.com/lesson",
    }

    tz  = pytz.timezone(TIMEZONE)
    now = datetime.datetime.now(tz).timestamp()

    r = web.post(
        "https://stories.duolingo.com/api2/stories/fr-en-le-passeport/complete",
        headers={**lesson_hdrs, "origin": "https://stories.duolingo.com"},
        json={
            "awardXp":                      True,
            "completedBonusChallenge":      True,
            "fromLanguage":                 "fr",
            "learningLanguage":             "en",
            "hasXpBoost":                   False,
            "illustrationFormat":           "svg",
            "isFeaturedStoryInPracticeHub": True,
            "isLegendaryMode":              True,
            "isV2Redo":                     False,
            "isV2Story":                    False,
            "masterVersion":                True,
            "maxScore":                     0,
            "score":                        0,
            "happyHourBonusXp":             469,
            "startTime":                    now,
            "endTime":                      now + random.randint(300, 420),
        },
    )
    xp_ok = r.status_code == 200
    if not xp_ok:
        log(f"  {prefix} ⚠  XP boost HTTP {r.status_code}: {r.text[:150]}")

    return {
        "id":       duo_id,
        "username": username,
        "email":    email,
        "password": password,
        "jwt":      jwt,
        "xp_boost": xp_ok,
    }

def worker(index: int, total: int) -> tuple[int, dict | None, str | None]:
    try:
        acc = create_account(index, total)
        return (index, acc, None)
    except Exception as e:
        return (index, None, str(e))

def main():
    print("═" * 54)
    print("   DuoHacker Generator v1")
    print("═" * 54)

    try:
        count = int(input("\n  [?] How many accounts to create? [1]: ").strip() or "1")
        if count < 1:
            count = 1
    except ValueError:
        count = 1

    threads = min(
        int(input(f"  [?] Max concurrent threads? [1-{MAX_THREADS}] [{min(count, MAX_THREADS)}]: ").strip() or min(count, MAX_THREADS)),
        MAX_THREADS,
        count
    )
    if threads < 1:
        threads = 1

    print(f"\n  [/] Starting {count} account(s) with {threads} thread(s)...\n")
    print("─" * 54)

    results = []
    success = 0
    failed  = 0

    start_time = time.time()

    with ThreadPoolExecutor(max_workers=threads) as executor:
        futures = {executor.submit(worker, i + 1, count): i + 1 for i in range(count)}

        for future in as_completed(futures):
            idx, acc, err = future.result()
            results.append((idx, acc, err))

            if acc:
                success += 1
                log(f"\n  ✅ Account {idx} done!")
                log(f"     Username : {acc['username']}")
                log(f"     Email    : {acc['email']}")
                log(f"     Password : {acc['password']}")
                log(f"     ID       : {acc['id']}")
                log(f"     XP boost : {'✓ 499 XP' if acc['xp_boost'] else '✗ failed'}")
            else:
                failed += 1
                log(f"\n  ❌ Account {idx} failed: {err}")

    elapsed = time.time() - start_time
    print(f"\n{'═' * 54}")
    print(f"  ✅ Success : {success}/{count}")
    print(f"  ❌ Failed  : {failed}/{count}")
    print(f"  ⏱  Time    : {elapsed:.1f}s")
    print("═" * 54)

if __name__ == "__main__":
    main()
