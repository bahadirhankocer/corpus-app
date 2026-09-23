export interface ChangelogItem {
  tr: string;
  en: string;
}

export interface ChangelogRelease {
  version: string;
  date: string;
  title: ChangelogItem;
  items: ChangelogItem[];
}

/** Newest first. Add a release here whenever `version` in package.json is bumped. */
export const CHANGELOG: ChangelogRelease[] = [
  {
    version: '0.4.0',
    date: '2026-09-23',
    title: { tr: 'Sekans haritası', en: 'Sequence map' },
    items: [
      { tr: 'Harita artık AI\'ın çizdiği bir sekans haritası: girdiler 01, 02, 03 diye numaralanan kümelerde toplanır, kümeler bir matrisin noktalarına oturur, başlıklar büyük harfle iç içe istiflenir ve aralarında organik bağlar kurulur. Parmaklarla yakınlaşıp uzaklaşılır, bir kümeye dokununca ona yaklaşılır, bir başlığa dokununca girdi açılır.', en: 'The map is now a sequence map drawn by the AI: entries gather in clusters numbered 01, 02, 03, the clusters sit on the points of a matrix, their headlines stack in uppercase and organic ties grow between them. Pinch to zoom, tap a cluster to move closer, tap a headline to open the entry.' },
      { tr: 'Harita birkaç yeni girdide bir kendini yeniden çizer; aradaki yeni girdiler bir sonraki çizime kadar boş bir noktada bekler.', en: 'The map redraws itself every few entries; new entries wait at a free point until the next drawing.' },
      { tr: 'Audio Log metni artık kutularda değil: her bölüm Corpus gibi büyük ve düz bir metin, yazdıkça uzar, sürüklemek gerekmez.', en: 'The Audio Log text is no longer in boxes: each part is large plain text like the corpus and grows as you write, with nothing to drag.' },
      { tr: 'Audio Log iki dilli: bir dilde yazılan log, arayüz dili değişince o dile aktarılmış haliyle açılır. Orijinal değişirse çeviri yenilenir.', en: 'The Audio Log is bilingual: a log written in one language opens in the other when the interface language changes. When the original changes, the translation is redone.' },
      { tr: 'TXT indirme yerine "Google Docs\'a kaydet": log, Drive\'daki Corpus klasörüne bir Google Doc olarak kaydedilir; tekrar kaydedince aynı belge güncellenir.', en: '"Save to Google Docs" replaces the TXT download: the log is saved as a Google Doc in a Corpus folder on Drive, and saving again updates the same document.' },
    ],
  },
  {
    version: '0.3.1',
    date: '2026-09-22',
    title: { tr: 'Corpus takılmaları', en: 'Corpus stalls' },
    items: [
      { tr: 'Uygulama kapanırken yarıda kalan bir girdi artık Corpus\'u beklemede bırakmıyor; bir sonraki açılışta kendiliğinden yeniden işleniyor.', en: 'An entry cut off when the app closed no longer keeps the corpus waiting; it is processed again on the next start.' },
      { tr: '"Şimdi yaz" artık hiçbir şeyi beklemeden hemen yazar.', en: '"Write now" now writes immediately, without waiting for anything.' },
      { tr: 'İlk metin, eski girdilerin çevirilerinden önce yazılır.', en: 'The first text is written before older entries are translated.' },
      { tr: 'Corpus ekranı kaç girdinin işlendiğini ve bir sorun varsa ne olduğunu gösterir (kota, bağlantı, anahtar).', en: 'The corpus screen shows how many entries are processed and, if something is wrong, what (quota, connection, key).' },
      { tr: 'Asılı kalan bir AI isteği artık diğer işleri durdurmuyor.', en: 'A hanging AI request no longer stops every other job.' },
    ],
  },
  {
    version: '0.3.0',
    date: '2026-09-22',
    title: { tr: 'Corpus', en: 'Corpus' },
    items: [
      { tr: 'Uygulamanın adı artık Corpus. Adres: bahadirhankocer.github.io/corpus-app. Veriler ve anahtar yeni adrese kendiliğinden taşınır.', en: 'The app is now called Corpus, at bahadirhankocer.github.io/corpus-app. Data and the key move to the new address by themselves.' },
      { tr: 'Açılış ekranı artık Corpus: tüm girdileri tek bir lineer metin olarak okuyan, her girdi ve cevaptan sonra kendini yeniden yazan yaşayan bir metin. Çalışma başlığı, çekirdek paragraf, eksenler ve bir yön.', en: 'The first screen is now Corpus: a living text that reads all entries as one linear body of thought and rewrites itself after every entry and answer. A working title, a core paragraph, axes and a direction.' },
      { tr: 'Metindeki köprü kelimelere dokununca AI bunu neden düşündüğünü ve hangi girdilerden geldiğini tarih ve saatiyle anlatır.', en: 'Tapping a bridge term shows why the AI connected it and which entries it came from, with date and time.' },
      { tr: 'Corpus\'un eski sürümleri saklanır, ‹ › ile geriye bakılabilir.', en: 'Earlier versions of the corpus are kept; step back through them with ‹ ›.' },
      { tr: 'Dosya: video adayı, brief, senaryo, animasyon temaları ve yan fikirler kendiliğinden hazırlanır. Her animasyon teması için AI çalışan bir HTML eskizi yazıp uygulamanın içinde oynatır.', en: 'File: a video candidate, brief, scenario, animation themes and side ideas are prepared by themselves. For every animation theme the AI writes a working HTML sketch that plays inside the app.' },
      { tr: 'Soru cevapları artık ayrı not değil; sorulan girdinin içinde soru-cevap zinciri olarak durur. Her cevap bir sonraki, daha derin soruyu doğurur. Eski cevaplar taşındı.', en: 'Answers are no longer separate notes; they sit inside the entry that was asked about, as a question-and-answer thread, and each answer earns a deeper question. Existing answers were moved in.' },
      { tr: 'Düşünceler akışı kaldırıldı. Harita artık kendi sakin sekmesinde. Menü sadeleşti: Audio Log, Ayarlar, Sürümler; Sekans, Bağlantılar ve Özetler Dosya\'nın altında.', en: 'The thoughts stream is gone. The map has its own quiet page. The menu is shorter: Audio Log, Settings, Versions; Sequence, Connections and Digests live under the File.' },
      { tr: 'Tam çift dil: AI\'ın yazdığı her şey iki dilde saklanır, girdiler çevrilir. Dil değişince her şey birlikte değişir; orijinal metin bir dokunuş uzakta.', en: 'Fully bilingual: everything the AI writes is kept in both languages and entries are translated. Switching language changes everything at once; the original text is one tap away.' },
      { tr: 'Geri hareketi uygulamayı kapatmak yerine bir önceki ekrana döner. Yazarken geri gitmek yazılanı kaydeder.', en: 'The back gesture returns to the previous screen instead of closing the app. Going back while writing keeps what was written.' },
      { tr: 'Bildirimler: günde iki "seni dinledim" bildirimi (girdilerinden alıntılı), bir soru, sabah çekirdeği ve her girdiden birkaç saat sonra Corpus\'un nasıl değiştiğini söyleyen bir yankı. Metinler telefonda seçilir, hiçbir girdi dışarı çıkmaz.', en: 'Notifications: two "I listened" notes a day quoting your entries, one question, a morning core, and an echo a few hours after each entry saying how the corpus changed. Texts are chosen on the phone; no entry leaves it.' },
      { tr: 'Audio Log baştan yazıldı: kendi kendine konuşan bir ses, girdileri tarih ve saatleriyle kronolojik geçer, neyin neyi tetiklediğini ve soru-cevapları anlatıya örer, sonunda bir projeye yönelir. İlk log şimdiye kadarki her şeyi kapsar. Stil düzeltmeleri sessizce yapılır, revizyon gerekmez.', en: 'Audio Log rewritten: a voice talking to itself, walking through entries in order with their dates and times, weaving in what triggered what and the questions and answers, and ending on a direction. The first log covers everything so far. Style fixes happen silently; nothing to revise.' },
      { tr: 'Günlük özet kaldırıldı; haftalık özet iki dilde yazılır.', en: 'The daily digest was retired; the weekly digest is written in both languages.' },
    ],
  },
  {
    version: '0.2.2',
    date: '2026-09-18',
    title: { tr: 'Büyük harf', en: 'Capital letters' },
    items: [
      { tr: 'Büyük harfle yazılan etiketlerde İ yerine I kullanılıyor (ör. "ATELIER", "REPETITION").', en: 'Uppercase labels use a plain I instead of the dotted İ (for example "ATELIER", "REPETITION").' },
    ],
  },
  {
    version: '0.2.1',
    date: '2026-09-18',
    title: { tr: 'Hizalama', en: 'Alignment' },
    items: [
      { tr: 'Ana ekranda halkalar ve "Text / Audio" yazıları artık aynı merkezde. 9:16 dahil tüm ekran oranlarında simetrik kalıyor.', en: 'On the home screen the rings and the "Text / Audio" words now share one centre and stay symmetric at every screen ratio, 9:16 included.' },
      { tr: 'Yazı boyutu ekranın hem genişliğine hem yüksekliğine göre ölçekleniyor. Geniş ekranlarda içerik ortada bir sütunda duruyor.', en: 'Type scales with both the width and the height of the screen. On wide screens the content sits in a centred column.' },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-09-18',
    title: { tr: 'Atölye', en: 'The Atelier' },
    items: [
      { tr: 'Yeni ikon: siyah zeminde ince, küçük bir halka.', en: 'New icon: a small, thin ring on true black.' },
      { tr: 'Alt çubuk kalktı. Yakala, Akış ve Atölye arasında kaydırılıyor, altta tek bir ince gösterge var.', en: 'The bottom bar is gone. Swipe between Capture, Feed and Atelier; a single slim indicator sits below.' },
      { tr: 'Kaydırma bittiği anda ekran oturuyor. Yerleşirken zıplama giderildi.', en: 'The deck settles cleanly after a swipe. The bounce while snapping is fixed.' },
      { tr: 'Atölye: AI için ayrı bir çalışma alanı. Canlı harita, düşünce akışı, projelerin derlemesi ve diğer tüm katmanlara giriş.', en: 'Atelier: a separate workspace for the AI. A living map, a stream of thoughts, project compendiums and the way into every other layer.' },
      { tr: 'AI artık her yeni girdide kendiliğinden düşünüyor: sınıflandırır, bağ kurar, derlemeyi günceller, düşünce bırakır. İstekler kotaya göre sıraya dizilir.', en: 'The AI now thinks on every new entry by itself: it classifies, links, revises its compendium and leaves thoughts. Calls are queued to respect the quota.' },
      { tr: 'Günün rastgele saatlerinde AI sana kısa sorular getiriyor: derinleştirme, hayali animasyon bağlantıları, sekans senaryoları, çılgın örüntüler. Cevaplamak zorunda değilsin.', en: 'At random hours of the day the AI brings you short questions: deepening, imagined animation links, sequence scenarios, wild patterns. You never have to answer.' },
      { tr: 'Yeni proje açılınca 4 soruluk kısa bir görüşme yapılıyor. Cevaplardan projenin manifestosu ve AI\'ın çalışma prosedürü çıkıyor.', en: 'A new project starts with a short four-question interview. The answers become the project manifesto and the AI\'s working procedure.' },
      { tr: 'API anahtarı tek seferlik kurulum linkiyle giriliyor, sonra maskeli görünüyor. Değiştirmek istersen tek dokunuş yeter.', en: 'The API key is entered once through a setup link and then shown masked. Replacing it takes one tap.' },
      { tr: 'Tipografi sıklaştırıldı, Repetition estetiğine yaklaşan siyah zemin, mono etiketler ve halka hareketi eklendi.', en: 'Tighter typography, a black ground closer to the Repetition aesthetic, mono labels and the ring motion.' },
      { tr: 'Bildirimler için Cloudflare Worker taslağı (worker/) eklendi.', en: 'A Cloudflare Worker for push notifications was added (worker/).' },
      { tr: 'Sürümler sekmesi (bu sayfa).', en: 'A Versions layer (this page).' },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-09-17',
    title: { tr: 'İlk sürüm', en: 'First release' },
    items: [
      { tr: 'Yakalama: yazı ve ses, çevrimdışı çalışan yerel depolama.', en: 'Capture: text and voice, offline-first local storage.' },
      { tr: 'AI kuyruğu: transkript, kategori, proje, etiket ve özet.', en: 'AI queue: transcript, categories, project, tags and summary.' },
      { tr: 'Devam soruları ve Yankı: unutulmuş eski girdinin yeniden yüzeye çıkması.', en: 'Follow-up questions and Resurfacing of forgotten entries.' },
      { tr: 'Harita: girdiler arası bağlantı ve çelişki önerileri.', en: 'Map: suggested connections and contradictions between entries.' },
      { tr: 'Sekans: sürükle-bırak zaman çizelgesi, AI taslağı, sürüm geçmişi.', en: 'Sequence: drag-and-drop timeline, AI draft, version history.' },
      { tr: 'Dışa aktarma: PDF stil kılavuzu, voiceover taslağı, günlük ve haftalık özetler.', en: 'Exports: PDF style guide, voiceover draft, daily and weekly digests.' },
      { tr: 'Haftalık Audio Log: AI taslağı, stil denetimi, okuma modu.', en: 'Weekly Audio Log: AI draft, style lint, reading mode.' },
      { tr: 'GitHub Pages üzerinde PWA olarak yayın.', en: 'Published as a PWA on GitHub Pages.' },
    ],
  },
];
