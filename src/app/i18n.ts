// String keys used in UI
const K = [
  'draw','erase','role','triggers','play','save','share','undo','redo',
  'layer','of','settings','language','you_died','you_win','tap_retry',
  'score','saved','save_fail','link_copied','shoot',
] as const;

type Key = typeof K[number];

// Compact: translations[langIndex][keyIndex] = string
// Lang order matches LANGS array
const LANGS = [
  'en','ru','es','zh','ar','pt','fr','de','ja','ko',
  'hi','it','tr','pl','nl','uk','vi','th','id','ms',
  'sv','cs','ro','el','hu','da','fi','no','sk','bg',
  'hr','sr','lt','lv','et','sl','ka','he','fa','bn',
] as const;

const LANG_NAMES: Record<string, string> = {
  en:'English',ru:'Русский',es:'Español',zh:'中文',ar:'العربية',
  pt:'Português',fr:'Français',de:'Deutsch',ja:'日本語',ko:'한국어',
  hi:'हिन्दी',it:'Italiano',tr:'Türkçe',pl:'Polski',nl:'Nederlands',
  uk:'Українська',vi:'Tiếng Việt',th:'ไทย',id:'Bahasa',ms:'Melayu',
  sv:'Svenska',cs:'Čeština',ro:'Română',el:'Ελληνικά',hu:'Magyar',
  da:'Dansk',fi:'Suomi',no:'Norsk',sk:'Slovenčina',bg:'Български',
  hr:'Hrvatski',sr:'Srpski',lt:'Lietuvių',lv:'Latviešu',et:'Eesti',
  sl:'Slovenščina',ka:'ქართული',he:'עברית',fa:'فارسی',bn:'বাংলা',
};

const FLAGS: Record<string, string> = {
  en:'🇺🇸',ru:'🇷🇺',es:'🇪🇸',zh:'🇨🇳',ar:'🇸🇦',pt:'🇧🇷',fr:'🇫🇷',de:'🇩🇪',ja:'🇯🇵',ko:'🇰🇷',
  hi:'🇮🇳',it:'🇮🇹',tr:'🇹🇷',pl:'🇵🇱',nl:'🇳🇱',uk:'🇺🇦',vi:'🇻🇳',th:'🇹🇭',id:'🇮🇩',ms:'🇲🇾',
  sv:'🇸🇪',cs:'🇨🇿',ro:'🇷🇴',el:'🇬🇷',hu:'🇭🇺',da:'🇩🇰',fi:'🇫🇮',no:'🇳🇴',sk:'🇸🇰',bg:'🇧🇬',
  hr:'🇭🇷',sr:'🇷🇸',lt:'🇱🇹',lv:'🇱🇻',et:'🇪🇪',sl:'🇸🇮',ka:'🇬🇪',he:'🇮🇱',fa:'🇮🇷',bn:'🇧🇩',
};

// T[langIndex] = array of translated strings matching K order
const T: string[][] = [
  // en
  ['Draw','Erase','Role','Triggers','Play','Save','Share','Undo','Redo','Layer','of','Settings','Language','You Died!','You Win!','Tap to retry','Score','Saved!','Save failed','Link copied!','Shoot'],
  // ru
  ['Рисовать','Стереть','Роль','Триггеры','Играть','Сохранить','Поделиться','Отменить','Вернуть','Слой','из','Настройки','Язык','Ты погиб!','Победа!','Нажми для повтора','Счёт','Сохранено!','Ошибка','Ссылка скопирована!','Стрелять'],
  // es
  ['Dibujar','Borrar','Rol','Disparadores','Jugar','Guardar','Compartir','Deshacer','Rehacer','Capa','de','Ajustes','Idioma','¡Moriste!','¡Ganaste!','Toca para reintentar','Puntos','¡Guardado!','Error al guardar','¡Enlace copiado!','Disparar'],
  // zh
  ['绘制','擦除','角色','触发器','开始','保存','分享','撤销','重做','层','共','设置','语言','你死了！','你赢了！','点击重试','分数','已保存！','保存失败','链接已复制！','射击'],
  // ar
  ['رسم','مسح','دور','مشغلات','لعب','حفظ','مشاركة','تراجع','إعادة','طبقة','من','إعدادات','لغة','لقد مت!','فزت!','انقر للمحاولة','نقاط','تم الحفظ!','فشل الحفظ','تم نسخ الرابط!','إطلاق'],
  // pt
  ['Desenhar','Apagar','Papel','Gatilhos','Jogar','Salvar','Compartilhar','Desfazer','Refazer','Camada','de','Config.','Idioma','Morreu!','Venceu!','Toque para tentar','Pontos','Salvo!','Erro ao salvar','Link copiado!','Atirar'],
  // fr
  ['Dessiner','Effacer','Rôle','Déclencheurs','Jouer','Sauver','Partager','Annuler','Rétablir','Couche','de','Paramètres','Langue','Tu es mort!','Victoire!','Touche pour réessayer','Score','Sauvegardé!','Échec','Lien copié!','Tirer'],
  // de
  ['Zeichnen','Löschen','Rolle','Auslöser','Spielen','Speichern','Teilen','Rückgängig','Wiederherstellen','Ebene','von','Einstellungen','Sprache','Gestorben!','Gewonnen!','Tippen zum Wiederholen','Punkte','Gespeichert!','Fehler','Link kopiert!','Schießen'],
  // ja
  ['描く','消す','役割','トリガー','プレイ','保存','共有','元に戻す','やり直す','レイヤー','の','設定','言語','死亡！','勝利！','タップしてリトライ','スコア','保存済み！','保存失敗','リンクコピー済み！','撃つ'],
  // ko
  ['그리기','지우기','역할','트리거','플레이','저장','공유','실행취소','다시실행','레이어','중','설정','언어','사망!','승리!','탭하여 재시도','점수','저장됨!','저장 실패','링크 복사됨!','발사'],
  // hi
  ['बनाएं','मिटाएं','भूमिका','ट्रिगर','खेलें','सेव','शेयर','अनडू','रीडू','परत','का','सेटिंग','भाषा','आप मारे गए!','आप जीते!','फिर से टैप करें','स्कोर','सेव हुआ!','सेव विफल','लिंक कॉपी!','गोली'],
  // it
  ['Disegna','Cancella','Ruolo','Trigger','Gioca','Salva','Condividi','Annulla','Ripeti','Livello','di','Impostazioni','Lingua','Sei morto!','Hai vinto!','Tocca per riprovare','Punteggio','Salvato!','Errore','Link copiato!','Spara'],
  // tr
  ['Çiz','Sil','Rol','Tetikleyiciler','Oyna','Kaydet','Paylaş','Geri al','Yinele','Katman','/',  'Ayarlar','Dil','Öldün!','Kazandın!','Tekrar dene','Puan','Kaydedildi!','Hata','Link kopyalandı!','Ateş'],
  // pl
  ['Rysuj','Wymaż','Rola','Wyzwalacze','Graj','Zapisz','Udostępnij','Cofnij','Ponów','Warstwa','z','Ustawienia','Język','Zginąłeś!','Wygrałeś!','Dotknij aby ponowić','Wynik','Zapisano!','Błąd zapisu','Link skopiowany!','Strzelaj'],
  // nl
  ['Teken','Wis','Rol','Triggers','Speel','Opslaan','Delen','Ongedaan','Opnieuw','Laag','van','Instellingen','Taal','Je bent dood!','Je wint!','Tik om opnieuw','Score','Opgeslagen!','Opslaan mislukt','Link gekopieerd!','Schieten'],
  // uk
  ['Малювати','Стерти','Роль','Тригери','Грати','Зберегти','Поділитися','Скасувати','Повернути','Шар','з','Налаштування','Мова','Ти загинув!','Перемога!','Натисни знову','Рахунок','Збережено!','Помилка','Посилання скопійовано!','Стріляти'],
  // vi
  ['Vẽ','Xóa','Vai trò','Kích hoạt','Chơi','Lưu','Chia sẻ','Hoàn tác','Làm lại','Lớp','của','Cài đặt','Ngôn ngữ','Bạn chết!','Bạn thắng!','Chạm để thử lại','Điểm','Đã lưu!','Lỗi lưu','Đã sao chép!','Bắn'],
  // th
  ['วาด','ลบ','บทบาท','ทริกเกอร์','เล่น','บันทึก','แชร์','เลิกทำ','ทำซ้ำ','ชั้น','จาก','ตั้งค่า','ภาษา','คุณตาย!','คุณชนะ!','แตะเพื่อลองใหม่','คะแนน','บันทึกแล้ว!','บันทึกล้มเหลว','คัดลอกลิงก์แล้ว!','ยิง'],
  // id
  ['Gambar','Hapus','Peran','Pemicu','Main','Simpan','Bagikan','Undo','Redo','Lapisan','dari','Pengaturan','Bahasa','Kamu mati!','Kamu menang!','Ketuk untuk coba lagi','Skor','Tersimpan!','Gagal simpan','Link disalin!','Tembak'],
  // ms
  ['Lukis','Padam','Peranan','Pencetus','Main','Simpan','Kongsi','Buat asal','Buat semula','Lapisan','dari','Tetapan','Bahasa','Anda mati!','Anda menang!','Ketuk untuk cuba lagi','Skor','Disimpan!','Gagal','Pautan disalin!','Tembak'],
  // sv
  ['Rita','Radera','Roll','Utlösare','Spela','Spara','Dela','Ångra','Gör om','Lager','av','Inställningar','Språk','Du dog!','Du vann!','Tryck för att försöka','Poäng','Sparat!','Misslyckades','Länk kopierad!','Skjut'],
  // cs
  ['Kreslit','Smazat','Role','Spouště','Hrát','Uložit','Sdílet','Zpět','Znovu','Vrstva','z','Nastavení','Jazyk','Zemřel jsi!','Vyhrál jsi!','Klepni znovu','Skóre','Uloženo!','Chyba','Odkaz zkopírován!','Střelba'],
  // ro
  ['Desenează','Șterge','Rol','Declanșatoare','Joacă','Salvează','Partajează','Anulează','Refă','Strat','din','Setări','Limbă','Ai murit!','Ai câștigat!','Atinge pentru a reîncerca','Scor','Salvat!','Eroare','Link copiat!','Trage'],
  // el
  ['Σχεδίασε','Σβήσε','Ρόλος','Ενεργοποιητές','Παίξε','Αποθήκευση','Κοινοποίηση','Αναίρεση','Επανάληψη','Επίπεδο','από','Ρυθμίσεις','Γλώσσα','Πέθανες!','Κέρδισες!','Πάτα ξανά','Σκορ','Αποθηκεύτηκε!','Αποτυχία','Αντιγράφηκε!','Πυροβόλησε'],
  // hu
  ['Rajzolj','Törlés','Szerep','Triggerek','Játék','Mentés','Megosztás','Visszavonás','Újra','Réteg','ból','Beállítások','Nyelv','Meghaltál!','Nyertél!','Koppints újra','Pont','Mentve!','Hiba','Link másolva!','Lövés'],
  // da
  ['Tegn','Slet','Rolle','Udløsere','Spil','Gem','Del','Fortryd','Gentag','Lag','af','Indstillinger','Sprog','Du døde!','Du vandt!','Tryk for at prøve igen','Score','Gemt!','Fejl','Link kopieret!','Skyd'],
  // fi
  ['Piirrä','Pyyhi','Rooli','Liipaisimet','Pelaa','Tallenna','Jaa','Kumoa','Tee uudelleen','Kerros','/', 'Asetukset','Kieli','Kuolit!','Voitit!','Napauta uudelleen','Pisteet','Tallennettu!','Virhe','Linkki kopioitu!','Ammu'],
  // no
  ['Tegn','Slett','Rolle','Utløsere','Spill','Lagre','Del','Angre','Gjør om','Lag','av','Innstillinger','Språk','Du døde!','Du vant!','Trykk for å prøve igjen','Poeng','Lagret!','Feil','Lenke kopiert!','Skyt'],
  // sk
  ['Kresli','Vymaž','Rola','Spúšťače','Hraj','Ulož','Zdieľaj','Späť','Znova','Vrstva','z','Nastavenia','Jazyk','Zomrel si!','Vyhral si!','Klepni znova','Skóre','Uložené!','Chyba','Odkaz skopírovaný!','Streľ'],
  // bg
  ['Рисувай','Изтрий','Роля','Тригери','Играй','Запази','Сподели','Отмени','Повтори','Слой','от','Настройки','Език','Умря!','Победи!','Натисни отново','Точки','Запазено!','Грешка','Линкът е копиран!','Стреляй'],
  // hr
  ['Crtaj','Obriši','Uloga','Okidači','Igraj','Spremi','Podijeli','Poništi','Ponovi','Sloj','od','Postavke','Jezik','Umro si!','Pobijedio si!','Dodirni za ponovni pokušaj','Bodovi','Spremljeno!','Greška','Link kopiran!','Pucaj'],
  // sr
  ['Цртај','Обриши','Улога','Тригери','Играј','Сачувај','Подели','Поништи','Понови','Слој','од','Подешавања','Језик','Умро си!','Победио си!','Додирни поново','Бодови','Сачувано!','Грешка','Линк копиран!','Пуцај'],
  // lt
  ['Piešk','Trink','Rolė','Trigeriai','Žaisk','Išsaugok','Dalinkis','Atšaukti','Pakartoti','Sluoksnis','iš','Nustatymai','Kalba','Žuvai!','Laimėjai!','Bakstelėk pakartoti','Taškai','Išsaugota!','Klaida','Nuoroda nukopijuota!','Šauk'],
  // lv
  ['Zīmē','Dzēst','Loma','Trigeri','Spēlē','Saglabāt','Dalīties','Atsaukt','Atkārtot','Slānis','no','Iestatījumi','Valoda','Tu nomiri!','Tu uzvarēji!','Pieskaries vēlreiz','Punkti','Saglabāts!','Kļūda','Saite nokopēta!','Šaut'],
  // et
  ['Joonista','Kustuta','Roll','Päästikud','Mängi','Salvesta','Jaga','Võta tagasi','Tee uuesti','Kiht','/', 'Seaded','Keel','Sa surid!','Sa võitsid!','Puuduta uuesti','Skoor','Salvestatud!','Viga','Link kopeeritud!','Tulista'],
  // sl
  ['Riši','Izbriši','Vloga','Sprožilci','Igraj','Shrani','Deli','Razveljavi','Ponovi','Plast','od','Nastavitve','Jezik','Umrl si!','Zmagal si!','Tapni za ponovitev','Točke','Shranjeno!','Napaka','Povezava kopirana!','Streljaj'],
  // ka
  ['ხატვა','წაშლა','როლი','ტრიგერები','თამაში','შენახვა','გაზიარება','გაუქმება','გამეორება','ფენა','დან','პარამეტრები','ენა','მოკვდი!','გაიმარჯვე!','შეეხე ხელახლა','ქულა','შენახულია!','შეცდომა','ბმული კოპირებულია!','სროლა'],
  // he
  ['צייר','מחק','תפקיד','טריגרים','שחק','שמור','שתף','בטל','שחזר','שכבה','מתוך','הגדרות','שפה','מתת!','ניצחת!','הקש לנסות שוב','ניקוד','נשמר!','שגיאה','הקישור הועתק!','ירה'],
  // fa
  ['ترسیم','پاک','نقش','محرک‌ها','بازی','ذخیره','اشتراک','واگرد','بازگرد','لایه','از','تنظیمات','زبان','مردی!','بردی!','لمس برای تلاش مجدد','امتیاز','ذخیره شد!','خطا','لینک کپی شد!','شلیک'],
  // bn
  ['আঁকুন','মুছুন','ভূমিকা','ট্রিগার','খেলুন','সেভ','শেয়ার','পূর্বাবস্থা','পুনরায়','স্তর','এর','সেটিংস','ভাষা','আপনি মারা গেছেন!','আপনি জিতেছেন!','আবার চেষ্টা করুন','স্কোর','সেভ হয়েছে!','সেভ ব্যর্থ','লিংক কপি হয়েছে!','গুলি'],
];

let _lang = 0;

export function setLang(code: string) {
  const idx = LANGS.indexOf(code as any);
  if (idx >= 0) _lang = idx;
  localStorage.setItem('vd_lang', code);
}

export function getLang(): string {
  return LANGS[_lang];
}

export function t(key: Key): string {
  const ki = K.indexOf(key);
  if (ki < 0) return key;
  return T[_lang]?.[ki] ?? T[0][ki] ?? key;
}

export function getLangs(): { code: string; name: string; flag: string }[] {
  return LANGS.map(c => ({ code: c, name: LANG_NAMES[c] || c, flag: FLAGS[c] || '🏳️' }));
}

export function getFlag(code: string): string {
  return FLAGS[code] ?? '🏳️';
}

// Auto-detect language on load
export function initLang() {
  const saved = localStorage.getItem('vd_lang');
  if (saved) { setLang(saved); return; }
  const nav = navigator.language?.slice(0, 2) || 'en';
  const idx = LANGS.indexOf(nav as any);
  if (idx >= 0) _lang = idx;
}
