import json
import os
import urllib.request
from http.server import BaseHTTPRequestHandler


ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'


def claude(api_key, prompt):
    payload = json.dumps({
        'model': 'claude-haiku-4-5-20251001',
        'max_tokens': 1500,
        'system': 'Sen Turkiye\'yi cok iyi bilen bir seyahat asistanisin. Sadece JSON formatinda yanit ver.',
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


def build_prompt(bas, bit, cikis, sure_dakika, duraklar, tercihler=None):
    kim_map = {
        'aile':   'aile (cocuklar dahil)',
        'cift':   'cift',
        'yalniz': 'yalniz gezgin',
        'grup':   'arkadas grubu'
    }
    stil_map = {
        'hizli':  'hizli gecis (kisa molalar)',
        'normal': 'dengeli yolculuk',
        'kesif':  'detayli kesif (uzun molalar, acele yok)'
    }
    kon_map = {
        'evet':  'gece konaklama var',
        'hayir': 'gunubirlik, ayni gun donus'
    }

    t    = tercihler or {}
    kim  = kim_map.get(t.get('kim', ''), '')
    stil = stil_map.get(t.get('stil', ''), '')
    kon  = kon_map.get(t.get('konaklama', ''), '')

    pref_lines = []
    if kim:  pref_lines.append(f'- Kimlerle: {kim}')
    if stil: pref_lines.append(f'- Yolculuk stili: {stil}')
    if kon:  pref_lines.append(f'- Konaklama: {kon}')
    pref_text = '\n'.join(pref_lines) if pref_lines else '(belirtilmemis)'

    durak_lines = '\n'.join(
        f"- {d['saat']} -- {d['isim']} [{d.get('kategori', '')}]"
        for d in duraklar
    )

    return f"""Yolculuk: {bas} -> {bit}
Cikis saati: {cikis}
Toplam sure (duraklar olmadan): {sure_dakika} dakika

Kullanici tercihleri:
{pref_text}

Planlanan duraklar (tahmini varis saatleri):
{durak_lines}

Gorev: Tercihlere gore kisisellestirilmis, Turkce, samimi ve pratik bir yolculuk plani yaz.
Her durak icin ne yapilabilecegini ve kac dakika kalinabilecegini belirt.

SADECE su JSON formatinda yanit ver:
{{
  "plan": [
    {{
      "saat": "HH:MM",
      "yer": "mekanin adi",
      "sure": "30-60 dakika",
      "mesaj": "bu yer icin 1-2 cumle kisisel oneri"
    }}
  ],
  "ozet": "yolculuk icin 2-3 cumlelik genel degerlendirme ve tavsiye"
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
                return self._json({'hata': 'API anahtari eksik', 'plan': []}, 500)

            prompt = build_prompt(
                body.get('bas', ''),
                body.get('bit', ''),
                body.get('cikis', '08:00'),
                body.get('sure', 0),
                body.get('duraklar', []),
                body.get('tercihler', {})
            )
            raw  = claude(api_key, prompt)
            text = raw['content'][0]['text'].strip()

            if text.startswith('```'):
                text = text.split('```')[1]
                if text.startswith('json'):
                    text = text[4:]
            result = json.loads(text)

        except json.JSONDecodeError:
            result = {'hata': 'AI yaniti parse edilemedi', 'plan': []}
        except Exception as e:
            result = {'hata': str(e), 'plan': []}

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
