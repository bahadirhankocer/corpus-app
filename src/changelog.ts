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
