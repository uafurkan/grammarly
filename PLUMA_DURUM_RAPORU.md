# Pluma — Tam Durum Raporu

_Son güncelleme: 14 Haziran 2026_

Bu rapor, "Pluma vs Grammarly" analiziyle başlayan çalışmanın bugünkü
durumunu özetler. Başlangıçtaki durum haritasındaki eksiklerin neredeyse
tamamı kapatıldı; aşağıda **o zaman → şimdi** karşılaştırması var.

---

## 1. Durum Haritası — o zaman vs şimdi

| Özellik | Başlangıç | Şimdi | Nerede |
|---|---|---|---|
| Anlık yazım/dilbilgisi denetimi (tarayıcıda) | ✓ Var | ✓ Var | `engine/checker.ts`, worker |
| DOCX okuma/yazma | ✓ Var | ✓ Var | `files/docx-*.ts` |
| PDF düzenleme + yerinde hata altçizgisi | ✓ Var | ✓ Var (+ büyük sayfa düzeltmesi) | `pages/PdfEditor.tsx` |
| Excel/CSV hücre denetimi | ✓ Var | ✓ Var | `pages/SheetEditor.tsx` |
| Lehçe farkındalığı (en-US/en-GB, es-ES) | ✓ Var | ✓ Var | `engine/dialect.ts`, `rules/` |
| Akademik kaynak arama | ✓ Var | ✓ Var | `engine/source-finder.ts` |
| Özgünlük öz-denetimi | ✓ Basit | ✓ Karşılaştır akışı + verbatim/paraphrase | `OriginalityPanel`, `engine/originality.ts` |
| **Ton / üslup ölçer** | ❌ Yok | ✅ **Var** | `engine/analytics.ts` (`analyzeTone`) |
| **Okunabilirlik / Clarity (Hemingway)** | ❌ Yok | ✅ **Var** | `analytics.ts`, `editor/hemingway-plugin.ts` |
| **Yazım hedefleri (audience/formality/domain)** | ❌ Yok | ✅ **Var** | `engine/goals.ts`, `GoalsModal` |
| **Eş anlamlı + akıllı tamamlama** | ❌ Yok | ✅ **Var** | `engine/datamuse.ts`, `autocomplete-plugin`, `WordPopover` |
| **Cümle yeniden yazma (LLM)** | ❌ Yok | ✅ **Var — cihaz-içi** | `ai/engine.ts` (WebLLM/Qwen2.5), `AssistPanel` |
| **Atıf üreteci (APA/MLA/Chicago/BibTeX)** | ❌ Yok | ✅ **Var** | `engine/citations.ts`, `BibliographyPanel` |
| **Word eklentisi (Office)** | ❌ Yok | ✅ **Var** | `office/`, `office-addin/manifest.xml` |
| **PWA / çevrimdışı** | ❌ Yok | ✅ **Var** | `vite-plugin-pwa`, `main.tsx` |
| **Cihazlar-arası taşıma** | ❌ Yok | ✅ **Var — sunucusuz .pluma paketi** | `store/sync.ts` |
| **İlk-ziyaret etkileşimli rehber** | ❌ Yok | ✅ **Var** | `components/Guide.tsx` |
| **Panel-içi "nasıl çalışır" rehberi (accordion)** | ❌ Yok | ✅ **Var** | `components/HelpAccordion.tsx` |
| Kullanıcı hesabı / bulut belgeleri | ❌ Yok | ⚪ Bilinçli kapsam dışı (paket yöntemi) | — |
| Tarayıcı uzantısı (her metin kutusu) | ❌ Yok | ⏳ Planlı ("yakında") | — |

**Özet:** Grammarly'nin _ücretli_ tarafının kazandığı her yer (yeniden yazma,
ton, paraphrase, atıf) artık Pluma'da — **ücretsiz ve cihaz-içi**. Geriye iki
bilinçli boşluk kalıyor: hesap/bulut senkron (sunucusuz paketle değiştirildi) ve
tarayıcı uzantısı (gelecek faz).

---

## 2. Mimari omurga (sistemi "bağlı" tutan)

Grammarly'nin 4 katmanlı mimarisinin Pluma karşılığı:

- **Katman 1 — Belge canvas:** ProseMirror/TipTap contentEditable. Gerçek metin
  burada. (`pages/Editor.tsx`)
- **Katman 2 — Altçizgi overlay:** `suggestions-plugin.ts` + `hemingway-plugin.ts`
  + `originality-plugin.ts` decorations; her transaction'da yeniden eşlenir.
- **Katman 3 — Kart/popup:** `SuggestionCard`, `WordPopover`.
- **Katman 4 — Sağ panel:** sekmeler (Suggestions / Originality / Citations /
  Assist / **? Rehber**) + analitik + ton + hedefler.

Tek birleştirici kavram: belge başına **`WritingContext = { goals, dialect, tone }`**
— kural motoru, ton ölçer ve AI prompt'unun ortak "kim için yazıyoruz" kaynağı.

**Motor tek beyin:** `src/engine/*` hem web uygulamasında hem Word eklentisinde
_aynı_ çalışır; Word'e özel tek kod `office/word.ts` (Office.js köprüsü).

---

## 3. Son yapılan işler (bu oturum)

1. **AppSource için gizlilik & şartlar sayfaları** — `public/privacy.html`,
   `public/terms.html` (temiz URL, SPA'dan bağımsız; SW denylist'e eklendi).
2. **Panel-içi "How Pluma works" accordion rehberi** — her özellik açılır-kapanır
   satır; doc editöründe tam set, PDF'te indirgenmiş set.
3. **Boş PDF sayfası düzeltmesi** — bazı büyük/yüksek-DPI PDF'ler canvas tarayıcı
   limitini (iOS ~4096px/16.7M px²) aşıp boş çiziliyordu; backing store artık
   güvenli sınırda — sayfa kaybolmuyor, hizalama bozulmuyor.

---

## 4. Kalan işler / fırsatlar

| Öncelik | İş | Not |
|---|---|---|
| Yüksek | **AppSource yayını** | Manifest hazır; Partner Center hesabı + ekran görüntüleri senden |
| Orta | **Tarayıcı uzantısı** | Her web metin kutusunda Pluma — en büyük yeni değer |
| Orta | **Word eklentisinde hedef seçici** | Şu an sessiz `DEFAULT_GOALS`; UI eklenebilir |
| Düşük | Hesap/bulut senkron (Supabase) | Sunucusuz paketin üstüne opsiyonel |
| Sürekli | QA / regresyon | Son düzeltmeleri gerçek cihazlarda doğrula |

---

## 5. Söz / kapsam sınırı

Pluma **ücretsiz** ve mümkün olduğunca **gizli** (metin cihazdan çıkmaz) kalır.
Akademik dürüstlük aracıdır — "AI humanizer" / tespit-atlatma özelliği bilinçli
olarak **yoktur**.
