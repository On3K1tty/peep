const L = navigator.language?.startsWith('ru') ? 1 : 0;
const T: Record<string, string>[] = [
  { draw:'Draw',erase:'Erase',role:'Role',triggers:'Triggers',play:'Play',save:'Save',share:'Share',undo:'Undo',redo:'Redo',layer:'Layer',of:'of',you_died:'You Died!',you_win:'You Win!',tap_retry:'Tap to retry',score:'Score',saved:'Saved!',save_fail:'Failed',link_copied:'Link copied!',back:'Back',start:'Start',splash_tip:'Tilt phone to move',gyro:'Gyro',gyro_toggle:'Gyro on/off',gyro_unavailable:'Gyro unavailable' },
  { draw:'Рисовать',erase:'Стереть',role:'Роль',triggers:'Триггеры',play:'Играть',save:'Сохранить',share:'Поделиться',undo:'Отменить',redo:'Вернуть',layer:'Слой',of:'из',you_died:'Ты погиб!',you_win:'Победа!',tap_retry:'Нажми для повтора',score:'Счёт',saved:'Сохранено!',save_fail:'Ошибка',link_copied:'Ссылка скопирована!',back:'Выйти',start:'Старт',splash_tip:'Наклон — управление',gyro:'Гиро',gyro_toggle:'Гиро вкл/выкл',gyro_unavailable:'Гиро недоступен' },
];

export const t = (k: string) => T[L]?.[k] ?? T[0][k] ?? k;
export const initLang = () => {};
