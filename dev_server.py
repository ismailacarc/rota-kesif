"""
Rota Keşif — Lokal geliştirme sunucusu
Çalıştır: python3 dev_server.py
Açıl:     http://localhost:8765
"""
import os, sys, json, importlib.util
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

BASE = Path(__file__).parent
PORT = 8765

# .env.local dosyasından ortam değişkenlerini yükle
env_file = BASE / '.env.local'
if env_file.exists():
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            os.environ[k.strip()] = v.strip()

# api/oner.py modülünü yükle
spec = importlib.util.spec_from_file_location('oner', BASE / 'api' / 'oner.py')
oner_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(oner_mod)


class DevHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE), **kwargs)

    def do_POST(self):
        if self.path == '/api/oner':
            oner_mod.handler(self.request, self.client_address, self.server)
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        if self.path == '/api/oner':
            oner_mod.handler(self.request, self.client_address, self.server)

    def log_message(self, fmt, *args):
        print(f'  {args[0]}  {args[1]}')


if __name__ == '__main__':
    print(f'\n🗺️  Rota Keşif Dev Server')
    print(f'   http://localhost:{PORT}')
    key = os.environ.get('ANTHROPIC_API_KEY', '')
    print(f'   API Anahtarı: {"✓ yüklendi" if key and key != "buraya_api_anahtarini_yaz" else "✗ EKSİK (.env.local kontrol et)"}')
    print(f'   Durdurmak için: Ctrl+C\n')
    HTTPServer(('', PORT), DevHandler).serve_forever()
