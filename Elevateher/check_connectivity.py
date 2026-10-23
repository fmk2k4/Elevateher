import urllib.request, os, time

files = [
    ('https://huggingface.co/aisingapore/SEA-LION-E5-Embedding-600M/resolve/main/model.safetensors',
     'models/sea-lion-e5-embedding-600m/model.safetensors'),
    ('https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf',
     'models/Phi-3-mini-4k-instruct-q4.gguf'),
]

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0 (KHTML, like Gecko) Chrome/120 Safari/537.0',
    'Accept': '*/*',
}

for url, dest in files:
    if os.path.exists(dest) and os.path.getsize(dest) > 10_000:
        print(f'SKIP: {dest} ({os.path.getsize(dest)/1024/1024:.1f} MB)')
        continue
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    # small piece download test
    try:
        req = urllib.request.Request(url, headers=headers, method='HEAD')
        with urllib.request.urlopen(req, timeout=30) as resp:
            total = int(resp.headers.get('Content-Length', 0))
            print(f'OK: {url} size={total/(1024*1024):.1f} MB')
    except Exception as e:
        print(f'HEAD FAIL: {url} -> {e}')
