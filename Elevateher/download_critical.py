import os
import time
import urllib.request
import urllib.error
from pathlib import Path

def download_with_retry(url, dest, max_retries=5, timeout=30):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0',
        'Accept': '*/*',
    }
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    for attempt in range(1, max_retries + 1):
        try:
            print(f'Attempt {attempt}/{max_retries}: {url}')
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = resp.read()
            with open(dest, 'wb') as f:
                f.write(data)
            size_mb = len(data) / (1024 * 1024)
            print(f'  OK -> {dest} ({size_mb:.1f} MB)')
            return True
        except Exception as e:
            print(f'  Error: {e}')
            time.sleep(3 * attempt)
    return False

files = [
    ('https://huggingface.co/aisingapore/SEA-LION-E5-Embedding-600M/resolve/main/model.safetensors',
     'models/sea-lion-e5-embedding-600m/model.safetensors'),
    ('https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf',
     'models/Phi-3-mini-4k-instruct-q4.gguf'),
]

ok = 0
for url, dest in files:
    if os.path.exists(dest) and os.path.getsize(dest) > 10_000:
        print(f'Already exists: {dest} ({os.path.getsize(dest)/1024/1024:.1f} MB)')
        ok += 1
    elif download_with_retry(url, dest):
        ok += 1
    else:
        print(f'FAILED: {dest}')

print(f'\nDownloaded: {ok}/{len(files)}')
