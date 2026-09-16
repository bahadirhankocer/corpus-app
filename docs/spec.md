# Corpus — Implementation Plan

Kişisel, simbiyotik bir fikir defteri. Gün içinde yazı ve sesli not olarak girilen fikirleri (tema, ses, voiceover cümlesi, sahne, animasyon) yakalar; arka planda AI ile sınıflandırır, projeye atar, fikirler arası bağlantı ve çelişkileri bulur; lineer bir sekans ve bağlantı haritası olarak genel bakış sunar.

Tek kullanıcı: Bahadırhan. Hedef cihazlar: Android telefon (ana yakalama cihazı) ve Windows dizüstü (genel bakış ve düzenleme).

---

## 0. Claude Code için çalışma kuralları

- Fazlara göre ilerle (bölüm 9). Her fazın sonunda kabul kriterlerini kontrol et, commit at, kısa bir özet yaz ve bir sonraki faza geçmeden onay iste.
- Kullanıcı en az kurulum istiyor. Her manuel adımı (hesap açma, anahtar alma, ayar tıklama) numaralı, tek tek, ekran adıyla anlat. Varsayma, sor.
- Mimari bir kararı değiştirmen gerekirse önce gerekçesiyle sor.
- Hiçbir API anahtarı veya client secret repoya girmez.
- Kod içi isimler İngilizce, arayüz metinleri i18n dosyalarında (TR + EN).

---

## 1. Kullanıcı kararları (anketten)

| Konu | Karar |
|---|---|
| Platform | Karar bana bırakıldı → **PWA** (bkz. bölüm 2) |
| Telefon | Android |
| Girdi türleri | Yazı, sesli not |
| Yakalama akışı | Her girdide birkaç alanlı kısa form |
| Sınıflandırma | AI tam otomatik (kullanıcı sonradan düzeltebilir) |
| Kategoriler | Tema / kavram · Ses / müzik · Voiceover cümlesi · Sahne / sekans · Animasyon / hareket |
| Proje ataması | AI tahmin eder |
| Genel bakış | Lineer zaman çizelgesi / sekans + bağlantı haritası (graf) |
| Sekans | AI taslak dizer, kullanıcı düzenler |
| AI davranışı | Bağlantı bulur, çelişkileri işaretler, **yeni fikir önermez, sadece düzenler** |
| Simbiyoz seviyesi | 3/5 — arka planda çalışır, sessizce öneri kartı gösterir, araya girmez |
| Depolama | Google Drive klasörü |
| Dışa aktarım | PDF style guide, voiceover senaryo taslağı |
| Offline | Şart |
| AI maliyeti | Tamamen ücretsiz |
| Transkripsiyon | Otomatik |
| Özetler | Gün sonu özeti, haftalık örüntü raporu |
| Estetik | Soğuk, klinik, minimal |
| Arayüz dili | İki dilli (TR/EN, ayarlardan geçiş) |
| Teknik rahatlık | En az kurulum |
| Haftalık Audio Log | Haftanın fikirlerinden, kullanıcının stil kurallarıyla yazılmış, monoton okunacak ontolojik bilinç akışı metni; kullanıcı kendi sesiyle bantta kaydedip "Audio Log" olarak yayınlar (bkz. bölüm 8.3) |

---

## 2. Mimari kararı ve gerekçesi

**PWA (Progressive Web App)**, ücretsiz statik hosting üzerinde.

- Tek kod tabanı hem Android'de (Chrome → "Ana ekrana ekle") hem Windows'ta (Chrome/Edge → "Uygulamayı yükle") çalışır.
- Android Studio, APK imzalama, mağaza gerekmez.
- Service worker ile tam offline çalışır; veriler cihazda IndexedDB'de durur.
- Mikrofon için HTTPS gerekir → GitHub Pages (ücretsiz, HTTPS hazır).

**Yığın:**
- Vite + React + TypeScript
- `vite-plugin-pwa` (service worker, manifest, offline cache)
- Dexie (IndexedDB sarmalayıcı)
- `MediaRecorder` API (sesli not, webm/opus)
- `@dnd-kit` (sekans sürükle-bırak)
- `cytoscape` (bağlantı haritası) — alternatif: `d3-force`
- `i18next` (TR/EN)
- PDF için ayrı kütüphane yok: özel yazdırma sayfası + `window.print()` → "PDF olarak kaydet"

**AI:** Google Gemini API, ücretsiz katman, Flash sınıfı model. Model adı kodda sabit değil; ayarlardan değiştirilebilir, varsayılan = güncel ücretsiz Flash modeli.

**Depolama:** Cihazda IndexedDB (ana kaynak) + Google Drive'a senkron (yedek ve cihazlar arası aktarım), Drive API `drive.file` kapsamı.

---

## 3. Bilinen ödünleşimler (kullanıcıya açıkça söylenecek)

1. **Gizlilik:** Gemini ücretsiz katmanında gönderilen içerik Google tarafından ürün geliştirme için kullanılabilir. Yayınlanmamış fikirler için bu önemli. Ayarlarda bir "AI işleme açık/kapalı" anahtarı ve bu uyarı bulunmalı. İleride ücretli anahtara geçiş sadece anahtar değişikliği olmalı.
2. **Offline transkripsiyon:** Ses kaydı offline tam çalışır. Transkripsiyon ve sınıflandırma internet geldiğinde kuyruktan otomatik yapılır. Cihaz üstü transkripsiyon (Whisper vb.) V1 kapsamı dışında; bölüm 11'de.
3. **Bildirimler:** Sunucusuz PWA'da zamanlanmış bildirim güvenilir değil. Gün sonu özeti ve haftalık rapor, uygulama açıldığında üretilir ve üstte kart olarak görünür.
4. **Ücretsiz kota:** Dakikalık/günlük limitler var. Kuyruk 429 hatasında üstel geri çekilme ile bekler, hiçbir girdi kaybolmaz.

---

## 4. Veri modeli (Dexie)

```ts
type Category = 'theme' | 'sound' | 'voiceover' | 'scene' | 'motion';

interface Entry {
  id: string;                 // uuid
  createdAt: string;          // ISO
  updatedAt: string;
  kind: 'text' | 'voice';
  text?: string;              // yazılı girdi
  audioId?: string;           // AudioBlob tablosuna referans
  transcript?: string;
  title?: string;             // opsiyonel kısa başlık
  importance: 1 | 2 | 3;      // formda seçilir, varsayılan 2
  context?: string;           // "nerede/ne yaparken aklıma geldi" (opsiyonel)
  ai: {
    status: 'pending' | 'processing' | 'done' | 'error' | 'disabled';
    categories: Category[];   // birden fazla olabilir
    projectId?: string;
    projectConfidence?: number; // 0–1
    tags: string[];
    summary?: string;         // tek cümle, kullanıcının sözlerine sadık
    error?: string;
    processedAt?: string;
  };
  overrides: {                // kullanıcı düzeltmeleri AI'yı ezer
    categories?: Category[];
    projectId?: string;
    tags?: string[];
  };
  sync: { driveFileId?: string; dirty: boolean };
}

interface AudioBlob { id: string; blob: Blob; mime: string; durationSec: number; driveFileId?: string }

interface Project {
  id: string;
  name: string;
  description: string;        // AI proje tahmini için bağlam
  keywords: string[];
  status: 'active' | 'archived';
}

interface Link {
  id: string;
  fromId: string;
  toId: string;
  kind: 'connection' | 'contradiction';
  rationale: string;          // en fazla 1 cümle
  state: 'suggested' | 'accepted' | 'dismissed';
  createdAt: string;
}

interface Sequence {
  id: string;
  projectId: string;
  version: number;
  source: 'ai' | 'user';
  sections: {
    id: string;
    label: string;            // ör. "Intro"
    entryIds: string[];       // sıralı
    note?: string;            // kullanıcı notu
  }[];
  updatedAt: string;
}

interface Digest { id: string; kind: 'daily' | 'weekly'; periodStart: string; body: string; entryIds: string[]; createdAt: string }

interface AudioLog {
  id: string;
  number: number;             // 2 → "AUDIO LOG 002"
  title: string;              // tek kavram, büyük harf, ör. SCHIZOPHONIA
  weekStart: string;
  lang: 'tr' | 'en';
  version: number;
  paragraphs: {
    text: string;
    sourceEntryIds: string[]; // her paragraf en az bir girdiye dayanır
    cue?: string;             // opsiyonel yapım işareti, okuma modunda gizli
  }[];
  patreonIntro: string;       // bölümü özetleyen kısa giriş metni
  lintWarnings: string[];     // stil denetimi sonuçları
  status: 'draft' | 'final' | 'recorded' | 'published';
  createdAt: string;
}

interface Settings {
  lang: 'tr' | 'en';
  geminiApiKey?: string;
  model: string;
  aiEnabled: boolean;
  driveConnected: boolean;
  activeProjectId?: string;
  styleGuide: string;         // düzenlenebilir stil kuralları (bkz. 8.3)
  audioLog: { nextNumber: number; targetMinutes: number; wordsPerMinute: number; lang: 'tr' | 'en'; cues: boolean };
}
```

Etkin değer kuralı: `overrides.X ?? ai.X`.

---

## 5. Ekranlar

**5.1 Yakala (ana ekran, varsayılan)**
- Üstte büyük iki buton: `Yaz` / `Kaydet (ses)`.
- Form alanları: metin veya ses kaydı · kısa başlık (ops.) · önem (1–3, segment kontrol) · bağlam (ops., tek satır) · "Kaydet".
- Kayıt en fazla 2 dokunuşta biter. Kaydedince form sıfırlanır, altta "Kaydedildi · işleniyor" durumu.
- Offline iken üstte ince bir "çevrimdışı · kuyrukta N girdi" şeridi.

**5.2 Akış**
- Girdilerin ters kronolojik listesi. Her kartta kategori rozetleri, proje adı (güven düşükse "?" ile), etiketler, AI durumu.
- Karta dokununca detay: transkript, ses oynatıcı, kategori/proje/etiket düzeltme.
- Filtre: proje, kategori, tarih.

**5.3 Sekans (lineer genel bakış)**
- Proje seçilir. Yatay (masaüstü) / dikey (telefon) zaman çizelgesi, bölümler halinde.
- Her bölümde girdi kartları, kategoriye göre ince bir sol şerit ile ayrılır.
- Sürükle-bırak ile sıralama, bölüm ekle/yeniden adlandır/sil.
- "AI taslağı oluştur" butonu → yeni `Sequence` versiyonu; önceki versiyonlar korunur ve geri dönülebilir.
- Yan panelde kategori bazlı özet: bu projedeki tüm voiceover cümleleri, tüm ses fikirleri vb. ("style guide görünümü").

**5.4 Harita**
- Girdiler düğüm, `Link`'ler kenar. Bağlantı = düz ince çizgi, çelişki = kesik çizgi + uyarı rengi.
- Önerilen bağlantılar yarı saydam; dokununca gerekçe + `Kabul` / `Reddet`.
- Proje ve kategoriye göre filtre.

**5.5 Özetler**
- Gün sonu ve haftalık rapor kartları, geçmiş listesi.

**5.6 Audio Log**
- Liste: bölüm numarası, başlık, hafta, durum (taslak / final / kaydedildi / yayınlandı).
- Düzenleme görünümü: paragraflar, her birinin altında kaynak girdi bağlantıları, stil denetimi uyarıları, "yeniden yaz" (paragraf bazında), başlık ve Patreon giriş metni düzenleme.
- **Okuma modu (teleprompter):** tam ekran, büyük monospace metin, sabit ve yavaş kaydırma (hız ayarlı), ekran kapanmaz (Wake Lock API), kaynak referansları ve yapım işaretleri gizli, dokununca durur/devam eder. Koyu zemin, düşük kontrast; kayıt sırasında göz yormayacak.

**5.7 Ayarlar**
- Stil kılavuzu metni (düzenlenebilir) · Audio Log ayarları (sıradaki numara, hedef süre, dakikadaki kelime, dil, yapım işaretleri aç/kapat)
- Dil · Gemini API anahtarı (yalnız cihazda saklanır) · model adı · AI işleme aç/kapat + gizlilik uyarısı · Google Drive bağla/senkronla · projeleri yönet (ad, açıklama, anahtar kelimeler) · aktif proje · verileri JSON olarak dışa/içe aktar.

---

## 6. AI katmanı

### 6.1 Genel ilkeler (her prompt'a sistem talimatı olarak girer)
- Kullanıcının fikirlerine yeni içerik ekleme, yeni fikir üretme. Görevin sınıflandırmak, düzenlemek, ilişkilendirmek.
- Özetler kullanıcının kendi ifadelerine sadık kalır.
- Her çıktı ilgili girdi ID'lerini referans verir.
- Çıktı yalnızca JSON (Gemini structured output / `responseSchema` kullan). Parse hatasında bir kez yeniden dene, sonra `error` durumuna al.
- Girdi dili Türkçe veya İngilizce olabilir; etiketler girdinin dilinde.

### 6.2 İşler (kuyruk)
Kuyruk IndexedDB'de kalıcıdır; `online` olayında ve uygulama açılışında çalışır; tek seferde bir istek; 429'da üstel geri çekilme.

1. **transcribe+classify** (her yeni girdi için, tek çağrı)
   - Girdi: metin veya ses (base64 inline audio) + proje listesi (ad, açıklama, anahtar kelimeler).
   - Çıktı: `{ transcript?, categories[], projectId|null, projectConfidence, tags[], summary }`
2. **links** (yeni girdi işlendikten sonra, aynı projedeki son ~50 girdinin özetleriyle)
   - Çıktı: `{ links: [{ fromId, toId, kind, rationale }] }` — en fazla 3 öneri; zayıf ilişkileri önerme.
3. **sequence** (kullanıcı butona basınca)
   - Girdi: projedeki tüm girdilerin özet + kategori + etiketleri.
   - Çıktı: `{ sections: [{ label, entryIds[] }] }` — her girdi en fazla bir yerde; yerleşmeyenler "Yerleşmemiş" bölümüne.
4. **digest** (günlük: günün ilk açılışında önceki gün için; haftalık: pazartesi ilk açılışta)
   - Çıktı: tekrar eden motifler, açık çelişkiler, proje bazında girdi dağılımı. Gözlem dili, öneri yok.
5. **audiolog** (haftalık raporla birlikte otomatik; ayrıca "Bu haftanın log'unu hazırla" butonu)
   - Girdi: haftanın tüm girdileri (tüm projeler), stil kılavuzu, hedef kelime sayısı (`targetMinutes × wordsPerMinute`), önceki bölümlerin başlıkları (tekrar etmemek için).
   - Çıktı: `AudioLog` alanları (başlık, paragraflar + kaynak ID'leri, opsiyonel işaretler, Patreon girişi).
   - Bu iş, 6.1'deki "yeni içerik ekleme" kuralının tek istisnasıdır: AI bağlayıcı düzyazı yazar, ama **fikir içeriği yalnızca o haftanın girdilerinden gelir**. Kaynağı olmayan paragraf üretilmez.
   - Üretimden sonra stil denetimi (8.3) çalışır; ihlal varsa ilgili paragraflar bir kez yeniden yazdırılır, kalan ihlaller `lintWarnings`'e düşer.

### 6.3 Test fikstürü
Şu girdi uçtan uca test için kullanılmalı:

> "Introda yeni keşfettiğin tape sesini ve footage'ı kesinlikle kullanabilirsin. Hatta tüm essay voiceover bu estetikle ele alınabilir. Signature."

Beklenen: kategoriler ⊇ {`sound`, `voiceover`, `scene`}; etiketler ~ `tape`, `intro`, `signature`; özet kullanıcının ifadesine sadık; aktif video projesine atanır.

---

## 7. Google Drive senkronu

- Google Identity Services (token model), kapsam: `https://www.googleapis.com/auth/drive.file`.
- Drive'da bir kök klasör: `Corpus/` → alt klasörler `entries/` (her girdi bir JSON), `audio/` (webm), `exports/`.
- Strateji: cihaz ana kaynak; `dirty` kayıtlar yüklenir; açılışta Drive'daki `updatedAt` daha yeni olan kayıtlar indirilir (last-write-wins, girdi bazında). İki cihaz aynı girdiyi düzenlerse eski versiyon `entries/_conflicts/` altına kaydedilir.
- Token süresi dolunca sessizce yenilemeyi dene, olmazsa üstte "Drive'a yeniden bağlan" şeridi göster. Senkron hiçbir zaman yakalamayı engellemez.
- Kullanıcı için adım adım anlatılacak manuel kurulum: Google Cloud'da proje → Drive API'yi etkinleştir → OAuth izin ekranı (External, test modu, kendi e-postasını test kullanıcısı olarak ekle) → Web OAuth client ID, yetkili origin = GitHub Pages adresi + `http://localhost:5173`.
- Bu kurulum takılırsa geçici çözüm: Ayarlar'dan JSON dışa aktarımı, Drive'a elle yükleme.

---

## 8. Dışa aktarımlar

**8.1 PDF style guide** (proje bazında)
- Özel yazdırma rotası (`/print/:projectId`), A4, klinik minimal tipografi.
- Bölümler: proje adı ve tarih · tema/kavramlar · ses/müzik fikirleri · animasyon/hareket notları · sekans (bölüm bölüm, girdi özetleriyle) · kabul edilmiş bağlantılar · açık çelişkiler.
- `window.print()` → kullanıcı "PDF olarak kaydet" seçer. Masaüstünde birincil kullanım.

**8.2 Voiceover senaryo taslağı**
- Aktif sekans sırasına göre yalnızca `voiceover` kategorisindeki girdiler, **kullanıcının kendi cümleleri birebir** (metin veya transkript). AI yeni cümle yazmaz.
- Bölüm başlıkları sekanstan gelir. Her cümlenin altında küçük gri not: ilişkili ses/sahne fikirlerinin özetleri.
- Çıktı: `.md` ve `.txt` indirme + Drive `exports/` klasörüne kopya.

**8.3 Haftalık Audio Log**

Amaç: haftanın fikirlerini, kullanıcının kendi sesiyle bantta kaydedeceği ve "Audio Log" serisinde yayınlanacak bir bilinç akışı metnine dönüştürmek. Uygulama ses üretmez veya işlemez; kayıt ve bant işlemesi kullanıcının kendi zincirinde yapılır. Uygulamanın işi metin, okuma modu ve yayın metinleridir.

Seri bağlamı (prompt'a sabit olarak girer):
- Format: "AUDIO LOG 00N — BAŞLIK". İlk bölüm "AUDIO LOG 001 — SCHIZOPHONIA"; varsayılan `nextNumber = 2`.
- Kayıt bantta yapılır (wow, flutter dahil); ses tek bir tonda, tonal ifade azaltılmış, "çıplak" okunur.
- Görselde bant döner, kayıt boyunca yavaş bir geri zoom olur ve zoom ile oda sesi giderek duyulur hale gelir.
- Seri, Repetition essay'inin evreninde geçer, ama tam olarak değil; arşiv estetiği korunur.
- Her Patreon yayınından önce bölümü özetleyen bir giriş metni gelir.

Metin nitelikleri:
- Ontolojik bilinç akışı: haftanın motifleri arasında çağrışımla ilerleyen, kesintisiz, tek sesli düşünme.
- Monoton okumaya uygun ritim: kısa ve orta uzunlukta cümleler, vurgu gerektiren retorik yapılar yok, ünlem yok, soru cümlesi az.
- Başlık: haftanın baskın motifini taşıyan tek kavram, büyük harf.
- Yapım işaretleri (opsiyonel, ayarla açılır): köşeli parantezde kısa notlar, ör. `[oda sesi belirginleşir]`. Okuma modunda görünmez, dışa aktarımda ayrı işaretlenir.

Varsayılan stil kılavuzu (Ayarlar'da düzenlenebilir metin olarak gelir):
- Register: *duru*. Süssüz, açık, fazla açıklamasız, kasıntısız.
- Ana fikir en başta söylenir.
- Uzun tire (—) kullanılmaz. (Bölüm başlığı formatı hariç.)
- Hiçbir türde karşıtlık çifti kullanılmaz: "X değil Y", "X'i bırakıp Y'ye başlar", "X yapmaz, Y yapar", "not X but Y" vb.
- Performatif samimiyet yok.
- Kavram paleti serbestçe kullanılabilir: hauntology, communitas, entrainment, transient hypofrontality, spectromorphology.
- Kendi video işleri için "essay" denir, "film" denmez.
- Akademik atıf yapılırsa sayfa numarası zorunlu (ör. "Koçer, 2023, s. 14").

Stil denetimi (kod ile, AI'dan bağımsız):
- `—` karakteri (başlık dışında) → uyarı.
- Karşıtlık kalıpları için regex seti (TR: `\bdeğil\b[^.]{0,40}[,;]`, `\byerine\b`, `bırakıp`; EN: `\bnot\b[^.]{0,40}\bbut\b`, `\binstead of\b`, `\brather than\b`) → uyarı. Liste ayarlardan genişletilebilir.
- "film" kelimesi → uyarı.
- Parantez içinde yıl olup sayfa numarası olmayan atıf → uyarı.
- Kaynak girdisi olmayan paragraf → hata.
- Kelime sayısı hedefin ±%15'i dışında → uyarı.

Dışa aktarım:
- `AUDIO-LOG-00N-BASLIK.md` (kaynak referanslı, işaretli çalışma kopyası) ve `.txt` (yalnız okunacak metin).
- Patreon giriş metni ayrı `.txt`.
- Drive: `exports/audio-logs/` altına kopya. Durum `final` olunca numara bir artar.

---

## 9. Fazlar ve kabul kriterleri

**Faz 0 — İskelet ve yayın**
- Vite + React + TS + PWA kurulumu, GitHub reposu, GitHub Actions ile GitHub Pages'e otomatik deploy.
- Kullanıcıya: GitHub hesabı ve Pages açma adımları.
- ✅ Adres telefonda açılıyor, "Ana ekrana ekle" ile yüklenebiliyor, uçak modunda açılıyor.

**Faz 1 — Yakalama ve yerel depolama**
- Dexie şeması, Yakala ve Akış ekranları, ses kaydı ve oynatma, TR/EN, tema.
- ✅ Uçak modunda 5 yazı + 3 ses girdisi kaydedilir, uygulama kapatılıp açıldığında hepsi durur.

**Faz 2 — AI kuyruğu**
- Ayarlar'da API anahtarı, kuyruk, transcribe+classify, proje yönetimi, düzeltme arayüzü.
- ✅ Offline girilen ses notları internet gelince otomatik transkribe edilip sınıflanır; test fikstürü beklenen sonucu verir; kullanıcı düzeltmesi korunur.

**Faz 3 — Harita ve bağlantılar**
- links işi, harita ekranı, kabul/ret.
- ✅ Bir projede 10+ girdiyle harita okunabilir; çelişkiler görsel olarak ayrışıyor.

**Faz 4 — Sekans**
- sequence işi, zaman çizelgesi, sürükle-bırak, versiyonlar, style guide yan paneli.
- ✅ 20 girdilik projede AI taslağı oluşuyor, telefonda ve masaüstünde sıralama değiştirilebiliyor, eski versiyona dönülebiliyor.

**Faz 5 — Drive senkronu**
- OAuth, klasör yapısı, çift yönlü senkron, çakışma kaydı.
- ✅ Telefonda girilen girdi, masaüstünde açılışta görünüyor (ses dahil).

**Faz 6 — Dışa aktarım ve özetler**
- PDF style guide, VO taslağı, günlük/haftalık özet.
- ✅ Dışa aktarılan VO taslağındaki her cümle bir girdide birebir bulunuyor.

**Faz 7 — Haftalık Audio Log**
- audiolog işi, stil kılavuzu ayarı, kod tabanlı stil denetimi, Audio Log ekranı, okuma modu, dışa aktarımlar.
- ✅ 15+ girdilik bir haftadan metin oluşuyor; her paragraf en az bir girdiye bağlı; stil denetimi test cümlelerinde ("bu bir tekrar değil, bir dönüş" / "not a loop but a return" / "—") uyarı veriyor; okuma modu telefonda ekran kapanmadan sabit hızla akıyor; numara `final` sonrası 003'e geçiyor.

---

## 10. Görsel dil

- Soğuk, klinik, minimal. Düz yüzeyler, gölge ve degrade yok.
- Palet: nötr soğuk griler + tek soluk mavi-gri vurgu; çelişki için tek soluk uyarı tonu. Açık ve koyu tema (`prefers-color-scheme` + manuel geçiş).
- Tipografi: sans-serif gövde, meta bilgiler (tarih, ID, durum) monospace ve küçük.
- Kategori ayrımı renk yerine kısa kodlarla da okunabilir olmalı: `TMA` `SES` `VO` `SHN` `ANM`.
- Telefonda tek elle kullanım: birincil butonlar alt yarıda.

---

## 11. Kapsam dışı (V1 sonrası)

- Cihaz üstü transkripsiyon (whisper.cpp / WASM) ile tam offline AI
- Fotoğraf, link, eskiz girdileri
- Resolve marker / EDL dışa aktarımı
- Ücretli API anahtarına geçiş (yalnız ayar değişikliği olacak şekilde tasarlandı)
- Android paylaşım menüsünden girdi alma (Web Share Target)
- Audio Log için uygulama içi kayıt ve Patreon/YouTube'a otomatik yükleme
