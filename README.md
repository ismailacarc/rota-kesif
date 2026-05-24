# 🗺️ Rota Keşif

> İki şehir arası yolculukta, rota üzerindeki en iyi durakları **yapay zeka** ile keşfettiren ve planlatan web uygulaması.

**🌐 Canlı:** [rota-kesif.vercel.app](https://rota-kesif.vercel.app)

---

## Proje Hakkında

Uzun bir araba yolculuğunda (örn. Gaziantep → İstanbul) insan yol üzerinde **neyin durmaya değer** olduğunu çoğu zaman bilmez. Google Maps sadece arar; kişiselleştirmez, gerekçe sunmaz, planlamaz. Rota Keşif bu boşluğu doldurur: yolculuğu **kişisel bir yol arkadaşına** dönüştürür.

- Rota üzerindeki mekanları **otomatik bulur** ve kategoriler.
- Yapay zeka ile **sana özel** en iyi durakları **nedenleriyle** önerir.
- Her durağın **rotana kaç dakika eklediğini** söyler.
- Çıkış saatine göre **yolculuk takvimi** kurar.
- Planı **kaydet, paylaş, navigasyona aktar.**

> Bu proje, **İskenderun Teknik Üniversitesi** Bitirme Projesi olarak geliştirilmiştir (öğr. Nesrin Yarar). Akademik "yapay zeka çekirdeği" şartı, ürünün AI öneri motoruyla karşılanmaktadır.

---

## Özellikler

| Özellik | Açıklama |
|---|---|
| 🔎 **Rota üzeri keşif** | İki şehir arası rota çizimi + yol boyunca mekan bulma (20 km, kategorize) |
| 🏷️ **Kategori filtreleri** | Tarihi, Yemek, Müze, Doğa, Konaklama, Alışveriş |
| 📍 **Harita kümeleme** | Yoğun bölgelerde marker'ları gruplama (clustering) |
| ⏱️ **Sapma analizi** | Her durak için gerçek **"+X dakika"** hesabı (az/orta/çok sapma) |
| ✨ **AI akıllı öneri** | Tercihlere (kiminle/ilgi/bütçe) göre en iyi 5 durak + gerekçe |
| 📅 **Yolculuk planı** | Çıkış saatine göre zaman çizelgesi + AI plan + çoklu durak navigasyonu |
| 💾 **Kaydet & Paylaş** | Üyelik ile rota kaydetme, kayıtlı rotalar, paylaşılabilir link |
| 👤 **Profil hafızası** | Giriş yapan kullanıcının AI tercihleri hatırlanır |
| 📱 **Tam responsive** | Masaüstü + mobil (alttan açılan panel, dokunmatik uyumlu) |

---

## Kullanılan Teknolojiler

| Katman | Teknoloji |
|---|---|
| Arayüz | HTML + CSS + JavaScript (responsive) |
| Harita | Leaflet + CartoDB Light tiles |
| Kümeleme | Leaflet.markercluster |
| Geocode / Autocomplete | Nominatim (OpenStreetMap) |
| Rota + sapma hesabı | OSRM |
| Yapay zeka | Claude API (Haiku) |
| Backend | Vercel Python serverless fonksiyonları (`/api`) |
| Üyelik + veritabanı | Supabase (Auth + PostgreSQL) |
| Yayın | Vercel |

---

## Mimari

```
┌──────────────────────────────────────────────┐
│        KULLANICI (Masaüstü + Mobil)           │
│   HTML · CSS · JS · Leaflet · responsive       │
└──────┬──────────────────────────┬─────────────┘
       │ (ücretsiz API'ler)        │ (kendi backend'imiz)
 ┌─────┴────────┐         ┌────────┴──────────────┐
 │ Nominatim    │         │ Vercel /api (Python)   │
 │ OSRM         │         │  → Claude API (öneri,  │
 │ (rota+mekan) │         │     yolculuk planı)    │
 └──────────────┘         ├────────────────────────┤
                          │ Supabase (üyelik + DB) │
                          └────────────────────────┘
```

---

## Yerel Kurulum

```bash
# 1. Depoyu klonla
git clone https://github.com/nesrin-yarar/rota-kesif.git
cd rota-kesif

# 2. Geliştirme sunucusunu başlat (statik dosyalar + /api proxy)
python3 dev_server.py

# 3. Tarayıcıda aç
# http://localhost:8765
```

### Ortam Değişkenleri

AI özelliklerinin çalışması için:

```
ANTHROPIC_API_KEY=...   # Claude API anahtarı (Vercel ortam değişkeni)
```

Supabase bağlantı bilgileri (proje URL + açık anahtar) frontend içinde tanımlıdır; bunlar tarayıcıda kullanılması güvenli olan **açık** değerlerdir.

---

## Proje Yapısı

```
rota-kesif/
├── index.html              # Arayüz iskeleti
├── style.css               # Tasarım
├── app.js                  # Tüm uygulama mantığı (harita, AI, üyelik)
├── api/
│   ├── oner.py             # AI akıllı öneri (Claude)
│   └── plan.py             # AI yolculuk planı (Claude)
├── dev_server.py           # Yerel geliştirme sunucusu
├── vercel.json             # Yayın yapılandırması
└── PROJE_YOL_HARITASI.md   # Ürün yol haritası ve fazlar
```

---

## Geliştirme Aşamaları

- **FAZ A** — Keşif deneyimi + mobil responsive ✅
- **FAZ B** — Sapma analizi (detour) ✅
- **FAZ C** — AI akıllı öneri ✅
- **FAZ D** — Yolculuk planı ✅
- **FAZ E** — Kaydet & Paylaş (üyelik) ✅
- **FAZ F** — Yayın (Vercel) ✅

---

## Lisans

Bu proje akademik amaçla geliştirilmiştir.

**Geliştiren:** Nesrin Yarar — İskenderun Teknik Üniversitesi
