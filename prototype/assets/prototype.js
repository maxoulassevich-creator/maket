/* ==========================================================================
   Foodbeer — поведение прототипа.

   Главное здесь — переключатель роли. Он не прячет элементы стилями:
   разметка для чужой роли лежит в <template>, содержимое которого браузер
   в DOM не помещает вообще. Открыв инспектор под гостем, узла корзины
   не найти — его нет. Это прямое требование ТЗ 4.1 и «Структуры»:
   «это не "спрятать стилями" — этих элементов просто нет на публичных экранах».
   ========================================================================== */

(function () {
  'use strict';

  var ROLES = {
    guest:     'Гость',
    applicant: 'Заявитель',
    wholesale: 'Подтверждённый оптовик'
  };

  /* --- Роль ------------------------------------------------------------- */

  function currentRole() {
    var q = new URLSearchParams(location.search).get('role');
    if (q && ROLES[q]) { try { localStorage.setItem('fb-role', q); } catch (e) {} return q; }
    try { var s = localStorage.getItem('fb-role'); if (s && ROLES[s]) return s; } catch (e) {}
    return 'guest';
  }

  function setRole(r) {
    try { localStorage.setItem('fb-role', r); } catch (e) {}
    var u = new URL(location.href);
    u.searchParams.set('role', r);
    location.href = u.toString();      // полная перезагрузка — как серверный рендеринг
  }

  /* Разворачиваем разметку, предназначенную текущей роли.
     data-role-only="wholesale guest" на <template> — содержимое попадает
     в DOM только для перечисленных ролей.
     data-role-hide="wholesale" на обычном узле — узел УДАЛЯЕТСЯ (не прячется). */
  function applyRole(role) {
    document.querySelectorAll('template[data-role-only]').forEach(function (tpl) {
      var allowed = tpl.getAttribute('data-role-only').split(/\s+/);
      if (allowed.indexOf(role) !== -1) {
        tpl.parentNode.insertBefore(tpl.content.cloneNode(true), tpl);
      }
      tpl.remove();
    });
    document.querySelectorAll('[data-role-hide]').forEach(function (el) {
      var hidden = el.getAttribute('data-role-hide').split(/\s+/);
      if (hidden.indexOf(role) !== -1) el.remove();
    });
    document.body.setAttribute('data-role', role);
  }

  /* --- Панель прототипа -------------------------------------------------- */

  function buildBar(role) {
    var bar = document.createElement('div');
    bar.className = 'pbar';
    bar.setAttribute('aria-label', 'Служебная панель прототипа');

    var roleBtns = Object.keys(ROLES).map(function (r) {
      return '<button class="pbar__btn" data-role-set="' + r + '" aria-pressed="' +
             (r === role) + '">' + ROLES[r] + '</button>';
    }).join('');

    bar.innerHTML =
      '<span class="pbar__label pbar__hide-sm">Роль</span>' +
      '<span class="pbar__group">' + roleBtns + '</span>' +
      '<span class="pbar__spacer"></span>' +
      '<button class="pbar__btn" data-ann-toggle>Аннотации</button>' +
      '<a class="pbar__home" href="index.html">Все страницы</a>';

    document.body.appendChild(bar);

    bar.addEventListener('click', function (e) {
      var b = e.target.closest('[data-role-set]');
      if (b) { setRole(b.getAttribute('data-role-set')); return; }
      if (e.target.closest('[data-ann-toggle]')) {
        var on = document.body.classList.toggle('ann-on');
        try { localStorage.setItem('fb-ann', on ? '1' : '0'); } catch (err) {}
        e.target.setAttribute('aria-pressed', on);
      }
    });

    var annOn = '0';
    try { annOn = localStorage.getItem('fb-ann') || '0'; } catch (e) {}
    if (annOn === '1') {
      document.body.classList.add('ann-on');
      bar.querySelector('[data-ann-toggle]').setAttribute('aria-pressed', 'true');
    }
  }

  /* --- Аннотации Что / Как / Зачем --------------------------------------- */

  function buildAnnotations() {
    document.querySelectorAll('script.ann').forEach(function (node) {
      var data;
      try { data = JSON.parse(node.textContent); } catch (e) { return; }
      var host = node.parentElement;
      host.classList.add('ann-host');

      var panel = document.createElement('div');
      panel.className = 'ann-panel';
      panel.innerHTML =
        '<h4>' + esc(data.section || 'Секция') + '</h4>' +
        '<dl>' +
          (data.what ? '<dt>Что</dt><dd>' + esc(data.what) + '</dd>' : '') +
          (data.how  ? '<dt>Как</dt><dd>'  + esc(data.how)  + '</dd>' : '') +
          (data.why  ? '<dt>Зачем</dt><dd>' + esc(data.why) + '</dd>' : '') +
        '</dl>' +
        (data.src ? '<p class="ann-panel__src">Источник: ' + esc(data.src) + '</p>' : '');

      var mark = document.createElement('button');
      mark.className = 'ann-mark';
      mark.type = 'button';
      mark.textContent = '?';
      mark.title = 'Что / Как / Зачем';
      mark.addEventListener('click', function () {
        panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });

      node.replaceWith(panel);
      host.insertBefore(mark, host.firstChild);
    });
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* --- Поведение интерфейса ---------------------------------------------- */

  function ui() {
    /* Шапка прилипает и ужимается при прокрутке */
    var header = document.querySelector('.header');
    if (header) {
      var onScroll = function () { header.classList.toggle('is-stuck', window.scrollY > 140); };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    /* Меню каталога: клик, Esc, клик вне области, работа с клавиатуры */
    var catBtn = document.querySelector('[data-catalog-toggle]');
    var catMenu = document.querySelector('[data-catalog-menu]');
    if (catBtn && catMenu) {
      catMenu.hidden = true;
      var closeCat = function () { catMenu.hidden = true; catBtn.setAttribute('aria-expanded', 'false'); };
      catBtn.setAttribute('aria-expanded', 'false');
      catBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = catMenu.hidden;
        catMenu.hidden = !open;
        catBtn.setAttribute('aria-expanded', String(open));
      });
      document.addEventListener('click', function (e) {
        if (!catMenu.hidden && !catMenu.contains(e.target)) closeCat();
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeCat(); });
    }

    /* Подсказки поиска */
    var searchInput = document.querySelector('[data-search-input]');
    var suggest = document.querySelector('[data-search-suggest]');
    if (searchInput && suggest) {
      suggest.hidden = true;
      searchInput.addEventListener('focus', function () { suggest.hidden = false; });
      document.addEventListener('click', function (e) {
        if (!suggest.contains(e.target) && e.target !== searchInput) suggest.hidden = true;
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') suggest.hidden = true; });
    }

    /* Счётчики количества */
    document.querySelectorAll('.qty').forEach(function (q) {
      var val = q.querySelector('.qty__value');
      if (!val) return;
      var step = parseFloat(q.dataset.step || '1');
      var min = parseFloat(q.dataset.min || '1');
      var unit = q.dataset.unit || '';
      q.addEventListener('click', function (e) {
        var d = e.target.closest('[data-qty]');
        if (!d) return;
        var n = parseFloat(val.textContent) || min;
        n = Math.max(min, n + (d.dataset.qty === 'up' ? step : -step));
        val.textContent = (Math.round(n * 100) / 100) + (unit ? ' ' + unit : '');
      });
    });

    /* Мобильная шторка фильтров */
    var fToggle = document.querySelector('[data-filters-toggle]');
    var drawer = document.querySelector('[data-filters]');
    if (fToggle && drawer) {
      var backdrop;
      var close = function () {
        drawer.classList.remove('is-open', 'filters--drawer');
        if (backdrop) { backdrop.remove(); backdrop = null; }
      };
      fToggle.addEventListener('click', function () {
        drawer.classList.add('filters--drawer');
        requestAnimationFrame(function () { drawer.classList.add('is-open'); });
        backdrop = document.createElement('div');
        backdrop.className = 'drawer-backdrop';
        backdrop.addEventListener('click', close);
        document.body.appendChild(backdrop);
      });
      drawer.addEventListener('click', function (e) {
        if (e.target.closest('[data-filters-apply], [data-filters-close]')) close();
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    }

    /* Счётчик найденного пересчитывается ДО применения */
    var counter = document.querySelector('[data-filter-count]');
    if (counter && drawer) {
      var base = parseInt(counter.dataset.filterCount, 10) || 0;
      drawer.addEventListener('change', function () {
        var checked = drawer.querySelectorAll('input[type=checkbox]:checked').length;
        var n = checked ? Math.max(3, Math.round(base / (1 + checked * 0.55))) : base;
        counter.textContent = n;
        document.querySelectorAll('[data-filter-count-echo]').forEach(function (el) { el.textContent = n; });
      });
    }

    /* Вкладки и сегменты */
    document.querySelectorAll('[data-tabs]').forEach(function (group) {
      group.addEventListener('click', function (e) {
        var t = e.target.closest('[role="tab"], .segment');
        if (!t) return;
        e.preventDefault();
        group.querySelectorAll('[role="tab"], .segment').forEach(function (x) {
          x.setAttribute('aria-selected', String(x === t));
        });
        var panelId = t.getAttribute('aria-controls');
        if (!panelId) return;
        var scope = document.querySelector(group.dataset.tabs) || document;
        scope.querySelectorAll('[role="tabpanel"]').forEach(function (p) {
          p.hidden = (p.id !== panelId);
        });
      });
    });

    /* Переключатель вида списка */
    document.querySelectorAll('[data-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var wrap = document.querySelector('[data-view-target]');
        if (!wrap) return;
        document.querySelectorAll('[data-view]').forEach(function (b) {
          b.setAttribute('aria-pressed', String(b === btn));
        });
        wrap.classList.toggle('grid-3', btn.dataset.view === 'grid');
        wrap.classList.toggle('grid', btn.dataset.view === 'grid');
        wrap.classList.toggle('list-view', btn.dataset.view === 'list');
      });
    });
  }

  /* --- Запуск ------------------------------------------------------------- */

  var role = currentRole();
  applyRole(role);                    // до отрисовки контента страницы
  document.addEventListener('DOMContentLoaded', function () {
    applyRole(role);                  // на случай узлов ниже по документу
    buildAnnotations();
    buildBar(role);
    ui();
  });
})();
