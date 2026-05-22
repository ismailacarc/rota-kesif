import json
import os
import urllib.request
from http.server import BaseHTTPRequestHandler


ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'


def claude(api_key, prompt):
    payload = json.dumps({
        'model': 'claude-haiku-4-5-20251001',
        'max_tokens': 1200,
        'system': 'Sen Türkiye\'yi çok iyi bilen bir seyahat asistanısın. Sadece JSON formatında yanıt ver.',
        'messages': [{'role': 'user', 'content': prompt}]
    }).encode('utf-8')

    req = urllib.request.Request(
        ANTHROPIC_URL,
        data=payload,
        headers={
            'x-api-key': api_key,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        },
        method='POST'
    )
    with urllib.request.urlopen(req, timeout=25) as resp:
        return json.loads(resp.read())


def build_prompt(bas, bit, mekanlar, tercihler):
    kim_map    = {'aile': 'aile (çocuklar dahil)', 'cift': 'çift', 'yalniz': 'yalnız gezgin', 'grup': 'arkadaş grubu'}
    butce_map  = {'ekonomik': 'ekonomik (ücretsiz/ucuz tercih)', 'orta': 'orta bütçe', 'premium': 'premium (kalite öncelikli)'}

    kim     = kim_map.get(tercihler.get('kim', ''), '')
    ilgiler = ', '.join(tercihler.get('ilgi', []))
    butce   = butce_map.get(tercihler.get('butce', ''), '')

    pref_lines = []
    if kim:     pref_lines.append(f'- Kimlerle: {kim}')
    if ilgiler: pref_lines.append(f'- İlgi: {ilgiler}')
    if butce:   pref_lines.append(f'- Bütçe: {butce}')
    pref_text = '\n'.join(pref_lines) if pref_lines else '(belirtilmemiş)'

    mekan_lines = '\n'.join(
        f"{i+1}. {m['isim']} [{m.get('kategori','')}] – rotaya {m.get('uzaklik',0):.1f} km"
        for i, m in enumerate(mekanlar[:30])
    )

    return f"""Rota: {bas} → {bit}

Kullanıcı tercihleri:
{pref_text}

Rota üzerindeki mekanlar:
{mekan_lines}

Görev: Bu listeden en uygun 5 mekanı seç. Tercihlere göre kişiselleştir. Türkçe yaz. Kısa ve net ol.

SADECE şu JSON formatında yanıt ver, başka hiçbir şey ekleme:
{{
  "oneriler": [
    {{
      "isim": "mekanın birebir listede yazan adı",
      "sebep": "bu kullanıcıya özel, neden gitsin — 1 cümle",
      "aciklama": "mekan hakkında 2 cümle bilgi"
    }}
  ]
}}"""


class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors_headers()
        self.end_headers()

    def do_POST(self):
        result = {}
        try:
            length = int(self.headers.get('Content-Length', 0))
            body   = json.loads(self.rfile.read(length))

            api_key = os.environ.get('ANTHROPIC_API_KEY', '').strip()
            if not api_key:
                return self._json({'hata': 'API anahtarı eksik', 'oneriler': []}, 500)

            prompt   = build_prompt(
                body.get('bas', ''),
                body.get('bit', ''),
                body.get('mekanlar', []),
                body.get('tercihler', {})
            )
            raw      = claude(api_key, prompt)
            text     = raw['content'][0]['text'].strip()

            if text.startswith('```'):
                text = text.split('```')[1]
                if text.startswith('json'):
                    text = text[4:]
            result = json.loads(text)

        except json.JSONDecodeError:
            result = {'hata': 'AI yanıtı parse edilemedi', 'oneriler': []}
        except Exception as e:
            result = {'hata': str(e), 'oneriler': []}

        self._json(result)

    def _json(self, data, code=200):
        payload = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self._cors_headers()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', len(payload))
        self.end_headers()
        self.wfile.write(payload)

    def _cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def log_message(self, fmt, *args):
        pass
