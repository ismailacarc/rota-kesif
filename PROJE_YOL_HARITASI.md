# 🗺️ Rota Keşif — Ürün Yol Haritası

> **Yaşayan belge.** Her oturumda önce burayı oku — ürünün ne olduğunu, nerede kaldığımızı, sıradaki işi buradan anla.
> Yaklaşım: **Tam kullanıcı odaklı gerçek ürün** (yayınlanacak, fayda sağlayacak).
> Son güncelleme: 2026-05-21

---

## 1. Ürün Künyesi

| Alan | Bilgi |
|------|-------|
| **Ürün adı** | Rota Keşif |
| **Tek cümle** | İki şehir arası yolculukta, rota üzerindeki en iyi durakları yapay zeka ile keşfettiren ve planlatan web uygulaması. |
| **Kim için** | Türkiye'de şehirlerarası araba yolculuğu yapan herkes |
| **Geliştiren** | İsmail Acar |
| **Platform** | Web (masaüstü + mobil, tam responsive) |
| **Yayın hedefi** | Vercel (canlı, herkese açık) |

> *Not: Bu ürün aynı zamanda İskenderun Tek. Üniv. Bitirme Projesi II olarak da teslim edilecek (öğr. Nesrin Yarar). Akademik "AI çekirdeği zorunlu" şartı, ürünün AI öneri motoruyla zaten karşılanıyor.*

---

## 2. Vizyon & Değer Önerisi

**Problem:** Uzun bir araba yolculuğunda (ör. Gaziantep → İstanbul) insan yol üzerinde **neyin durmaya değer** olduğunu bilmez. Google Maps sadece arar, **kişiselleştirmez**, **gerekçe sunmaz**, **planlamaz**. Saatlerce forum/blog araştırmak gerekir.

**Çözüm:** Rota Keşif, yolculuğu **kişisel bir yol arkadaşına** dönüştürür:
- Rota üzerindeki mekanları **otomatik bulur** ve kategoriler.
- AI ile **sana özel** en iyi durakları **nedenleriyle** önerir.
- Her durağın **rotana kaç dakika eklediğini** söyler.
- Çıkış saatine göre **yemek/konaklama/gezi takvimi** kurar.
- Planı **kaydet, paylaş, navigasyona aktar.**

**Değer merdiveni (kullanıcıyı bağlayan sıra):**
```
Keşfet  →  Kişiselleştir  →  Planla  →  Eyleme geç
(gör)      (AI seç)          (takvim)    (kaydet/paylaş/git)
```

---

## 3. Hedef Kullanıcılar

| Persona | İhtiyaç |
|---------|---------|
| **Yol gezgini** | Uzun sürüşü bölecek değerli duraklar |
| **Aileler** | Çocuk dostu, mola verilebilir yerler; yemek & dinlenme |
| **Turistler** | Türkiye'yi arabayla keşfederken tarihi/kültürel yerler |
| **Hafta sonu kaçamakçıları** | Hızlı, az sapmayla güzel rotalar |

---

## 4. Kullanıcı Yolculuğu (Hedef Deneyim)

```
1. Rotayı gir (Ankara → İzmir) + tercihler
2. Rotayı ve keşfedilebilir mekanları gör
3. AI "senin için en iyi 5 durak"ı gerekçesiyle sunar
4. Her durak için "+kaç dk sapma" gör, karar ver
5. Çıkış saatine göre yemek/konaklama takvimini al
6. Durakları seç → plan oluşsun
7. Kaydet / paylaş / Google Maps'te navigasyona aç
```

---

## 5. Mevcut Durum (Nerede Kaldık)

✅ **Keşif deneyiminin çekirdeği çalışıyor:**
- Hero karşılama ekranı (harita arka planda, smooth geçiş)
- Şehir **autocomplete** (Nominatim, klavye destekli, hem hero hem topbar)
- Şehir → koordinat, **OSRM rota** çizimi
- **Overpass** ile yol üzeri mekan çekme (20 km, max 80, kategorize)
- 7 kategori **filtre** (chip)
- **Marker clustering** (zoom'a göre gruplama)
- Türkiye sınır vurgusu, temiz Light tema, Inter + Lucide UI

**Teknik temel:** Tüm harita/veri API'leri ücretsiz & anahtarsız. Henüz backend yok.

---

## 6. Geliştirme Planı (Kullanıcı Odaklı Fazlar)

> Her faz **tek başına kullanıcıya somut bir fayda** teslim eder.
> İşaretler: ✅ Tamam · 🔄 Devam · ⬜ Bekliyor

### FAZ A — Keşif Deneyimini Tamamla (Polish + Mobil) ⬜
**Kullanıcı kazanımı:** *"Her cihazda çalışıyor, bir mekana nasıl gideceğimi biliyorum."*
- ⬜ **Mekan detay paneli** (karta tıkla → yan/alt panelde tüm bilgi)
- ⬜ **"Yol tarifi al"** butonu → Google Maps / Apple Maps navigasyon linki
- ⬜ **Tam responsive**: mobilde panel alttan açılan sheet, büyük dokunmatik butonlar
- ⬜ Boş/hata durumları, "şehir bulunamadı" gibi zarif uyarılar
- ⬜ Rota üzerindeki ana şehirleri durak olarak işaretleme

### FAZ B — Sapma Analizi (Detour) ⬜  ⭐ Killer #1
**Kullanıcı kazanımı:** *"Her durak bana kaç dakikaya mal oluyor biliyorum."*
- ⬜ Rotaya dik mesafe yerine **gerçek "+X dk" hesabı** (OSRM: start→durak→end)
- ⬜ Kartta ve detayda **sapma süresi rozeti** (ör. "+12 dk")
- ⬜ Görsel işaret: az sapma yeşil / çok sapma turuncu
- ⬜ Sadece üst N aday için hesap (API tasarrufu + önbellek)

### FAZ C — AI Akıllı Öneri ⬜  ⭐ Killer #2 (ürünün kalbi)
**Kullanıcı kazanımı:** *"Bana özel en iyi durakları, nedenleriyle öğreniyorum."*
- ⬜ **Backend**: Vercel Python serverless fonksiyonları (`/api`) + Claude API
- ⬜ API anahtarı `.env`'de gizli (asla frontend'e girmez)
- ⬜ **Tercih girişi**: hızlı chip'ler (kiminle / ilgi / bütçe) + serbest doğal dil
- ⬜ **AI sıralama**: "Senin için en iyi 5 durak" + her biri için 1 cümle gerekçe
- ⬜ **AI mekan açıklaması** (OSM'de sadece isim var → "burası ne, neden uğra")
- ⬜ Prompt caching + sonuç önbellekleme (maliyet kontrolü)

### FAZ D — Yolculuk Planı ⬜  ⭐ Killer #3
**Kullanıcı kazanımı:** *"Çıkış saatime göre yemek/konaklama takvimim hazır."*
- ⬜ **Çıkış saati** girişi → rota süresiyle konumsal zaman hesabı
- ⬜ Zaman bazlı öneri: "13:00 Afyon → öğle yemeği", "19:00 Bolu → konaklama"
- ⬜ **AI itinerary builder**: "2 mola + 1 gece konaklama" gibi serbest istek
- ⬜ Seçilen durakları rotaya **waypoint** ekleme (rota güncellensin)

### FAZ E — Kaydet & Paylaş (Utility) ⬜
**Kullanıcı kazanımı:** *"Planımı saklıyorum, arkadaşımla paylaşıyorum."*
- ⬜ Trip kaydetme (önce localStorage, ileride hesap)
- ⬜ **Paylaşılabilir link** (rota + seçili duraklar URL'de kodlu)
- ⬜ "Tüm planı Google Maps'te aç" (çoklu durak)

### FAZ F — Yayınla (Deployment) ⬜
**Kullanıcı kazanımı:** *"Herkes erişebiliyor."*
- ⬜ Vercel'e deploy (frontend statik + Python `/api` fonksiyonları)
- ⬜ Özel domain (opsiyonel), basit analytics, geri bildirim butonu
- ⬜ Performans (lazy load), temel SEO (başlık/açıklama/OG)

### FAZ G — RAG Zenginleştirme (Derinlik) ⬜
**Kullanıcı kazanımı:** *"Öneriler kaynaklı, doğru, derin."*
- ⬜ Türkiye turizm bilgi tabanı (Wikipedia + rehberler)
- ⬜ Vektör DB (serverless'a uygun: Pinecone free tier veya yerel ChromaDB)
- ⬜ RAG ile kaynaklı, doğrulanabilir öneriler

---

## 7. Sistem Mimarisi

```
┌──────────────────────────────────────────────────────────┐
│              KULLANICI (Masaüstü + Mobil)                 │
│   HTML + CSS + JS + Leaflet  ·  responsive                │
│   Hero · Arama · Harita · Filtre · Öneri · Plan · Paylaş  │
└───────────┬───────────────────────────────┬──────────────┘
            │ (ücretsiz, anahtarsız)        │ (kendi backend'imiz)
   ┌────────┴──────────┐         ┌──────────┴──────────────────┐
   │ HARİTA/VERİ API   │         │  VERCEL /api (Python)        │
   │ • Nominatim       │         │  ┌────────────────────────┐  │
   │ • OSRM (rota+detour)│       │  │ Claude API: öneri+plan │  │
   │ • Overpass (mekan) │        │  └────────────────────────┘  │
   └───────────────────┘         │  ┌────────────────────────┐  │
                                 │  │ RAG (FAZ G): turizm DB │  │
                                 │  └────────────────────────┘  │
                                 └──────────────────────────────┘
```

---

## 8. Teknoloji Yığını

| Katman | Teknoloji | Ücret | Anahtar? |
|--------|-----------|-------|----------|
| Arayüz | HTML + CSS + JS (responsive) | Ücretsiz | — |
| Harita | Leaflet + CartoDB Light | Ücretsiz | Hayır |
| Clustering | Leaflet.markercluster | Ücretsiz | Hayır |
| İkon/Font | Lucide + Inter | Ücretsiz | Hayır |
| Geocode/Autocomplete | Nominatim | Ücretsiz | Hayır |
| Rota + sapma | OSRM | Ücretsiz | Hayır |
| Mekan | Overpass (OSM) | Ücretsiz | Hayır |
| Backend | Vercel Python serverless (`/api`) | Ücretsiz tier | — |
| **AI** | **Claude API** | Ücretli (cüzi) | **Evet 🔑** |
| RAG (FAZ G) | Pinecone free / ChromaDB | Ücretsiz tier | Pinecone'da evet |
| Hosting | Vercel | Ücretsiz tier | — |

---

## 9. Yayınlama Planı (Deployment)

- **Frontend:** Statik dosyalar → Vercel'e direkt deploy (zaten Vercel hesabı bağlı).
- **Backend:** Flask yerine **Vercel Python serverless fonksiyonları** (`/api/oner.py` gibi). Tek platform, ayrı sunucu derdi yok.
- **API anahtarı:** Vercel ortam değişkeni (Environment Variable) — koda/git'e asla yazılmaz.
- **RAG:** Serverless'ta kalıcı disk yok → vektör DB için hosted çözüm (Pinecone free) daha uygun. FAZ G'de netleşecek.

---

## 10. Tasarım İlkeleri

- **Mobil + masaüstü eşit** → tam responsive zorunlu.
- Masaüstü: yan panel + geniş harita. Mobil: harita tam ekran, mekanlar alttan açılan sheet.
- Büyük dokunmatik hedefler (mobilde min 44px).
- Hız hissi: iskelet/yükleniyor durumları, anlık geri bildirim.
- Sade ve net: kullanıcı ilk 5 saniyede ne yapacağını anlamalı (hero bunu sağlıyor).

---

## 11. Riskler ve Çözümler

| Risk | Çözüm |
|------|-------|
| Ücretsiz API hız limiti (OSRM/Overpass/Nominatim) | Önbellekleme, debounce, gerekirse yedek sunucu |
| Claude API maliyeti | Prompt caching, sonuç cache, sadece üst N mekana AI |
| Sapma hesabı çok API çağrısı | Yalnızca üst adaylara gerçek hesap, gerisi tahmini |
| OSM verisi seyrek (sadece isim) | AI/RAG ile zenginleştirme (zaten planın parçası) |
| Serverless'ta RAG zor | Hosted vektör DB (Pinecone) |
| API anahtarı sızması | Vercel env var, backend proxy |

---

## 12. Dosya Yapısı (Hedef)

```
Haritalar Uygulaması/
├── index.html              ✅
├── style.css               ✅
├── app.js                  ✅
├── PROJE_YOL_HARITASI.md   ← bu dosya
└── api/                    (FAZ C'de) ⬜
    ├── oner.py             # Claude öneri fonksiyonu
    ├── plan.py             # Yolculuk planı
    └── requirements.txt
```

---

## 13. SIRADAKİ ADIM

**FAZ A** ile başla: önce **mekan detay paneli + "yol tarifi al" linki**, ardından **mobil responsive**.
Bu, mevcut keşif deneyimini "gerçekten kullanılabilir" seviyeye çıkarır. Sonra FAZ B (sapma) → FAZ C (AI).

**Kararlar (sabit):**
- Tam responsive (mobil + masaüstü)
- Üç killer feature de yapılacak: Sapma + AI Öneri + Yolculuk Planı
- AI: Hibrit (LLM çekirdek, sonra RAG) · Backend: Vercel Python · Yayın: Vercel

---

## 14. Notlar
- Kullanıcı (İsmail) yazılımda başlangıç seviyesinde — her adım açıklanarak, onay alınarak ilerlenir.
- Ürün zihniyeti: "bitirme ödevi" değil, yayınlanıp fayda sağlayacak gerçek ürün.
- Bu dosya her faz ilerledikçe güncellenir (✅🔄⬜).
```
