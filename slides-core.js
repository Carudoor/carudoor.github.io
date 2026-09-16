// ---------------------------------------------------------------
// 슬라이드 덱 뷰어 — slides.html(전체 화면)과 홈페이지 마인드맵의
// 인라인 카드가 공유한다. 필요한 마크업은 전부 여기서 만들어 붙이므로,
// host는 빈 요소 하나만 넘기면 된다.
//
//   mountSlideDeck(el, {
//     manifestUrl: 'slides/manifest.json',
//     basePath:    'slides/',   // 덱 폴더들이 들어있는 위치
//     dots:     true,   // 우측 점 네비게이션
//     progress: true,   // 상단 진행 바
//     keyboard: true,   // ← / → / Space
//     tabs:     true,   // 덱이 2개 이상일 때 상단 덱 선택 탭
//     emptyText: '...'  // 슬라이드가 없을 때 보여줄 안내
//   });
//
// 매니페스트는 발표자료(덱) 목록이다. 덱 하나가 폴더 하나에 대응하고,
// 그 안의 이미지는 1.png, 2.png … 순번으로 저장한다:
//   [ { "name": "표시할 이름", "dir": "폴더명", "count": 43 } ]
// ---------------------------------------------------------------

function mountSlideDeck(root, options) {
  if (!root) return;
  var opts = options || {};
  var manifestUrl = opts.manifestUrl || 'slides/manifest.json';
  var basePath = opts.basePath || 'slides/';
  var useDots = opts.dots !== false;
  var useProgress = opts.progress !== false;
  var useKeyboard = opts.keyboard === true;
  var useTabs = opts.tabs !== false;
  var emptyText = opts.emptyText ||
    '아직 등록된 슬라이드가 없습니다. slides/ 에 덱 폴더를 만들고 slides/manifest.json에 추가해보세요.';

  root.classList.add('deck');
  if (useDots) root.classList.add('has-dots');

  var statusEl = document.createElement('div');
  statusEl.className = 'deck-status';
  statusEl.textContent = '슬라이드를 불러오는 중…';
  root.appendChild(statusEl);

  var progressFill = null;
  if (useProgress) {
    var progress = document.createElement('div');
    progress.className = 'deck-progress';
    progressFill = document.createElement('div');
    progressFill.className = 'deck-progress-fill';
    progress.appendChild(progressFill);
    root.appendChild(progress);
  }

  var tabsWrap = null;
  if (useTabs) {
    tabsWrap = document.createElement('div');
    tabsWrap.className = 'deck-tabs';
    tabsWrap.hidden = true; // 덱이 2개 이상일 때만 노출
    root.appendChild(tabsWrap);
  }

  var dotsWrap = null;
  if (useDots) {
    dotsWrap = document.createElement('div');
    dotsWrap.className = 'deck-dots';
    root.appendChild(dotsWrap);
  }

  function makeArrow(cls, label, text) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'deck-arrow ' + cls;
    b.setAttribute('aria-label', label);
    b.textContent = text;
    b.hidden = true; // 슬라이드가 실제로 있을 때만 노출
    root.appendChild(b);
    return b;
  }
  var prevBtn = makeArrow('deck-prev', '이전 슬라이드', '‹');
  var nextBtn = makeArrow('deck-next', '다음 슬라이드', '›');

  var countEl = document.createElement('div');
  countEl.className = 'deck-count';
  countEl.hidden = true;
  root.appendChild(countEl);

  var decks = [];
  var slides = [];
  var dots = [];
  var current = 0;

  // 덱 하나를 이미지 경로 배열로 바꾼다.
  // count가 있으면 1.png … N.png 로 만들고, files 배열이 있으면 그대로 쓴다.
  function deckImages(deck) {
    var dir = basePath + deck.dir + '/';
    if (Array.isArray(deck.files)) {
      return deck.files.map(function (f) { return dir + f; });
    }
    var out = [];
    var ext = deck.ext || 'png';
    for (var i = 1; i <= (deck.count || 0); i++) {
      out.push(dir + i + '.' + ext);
    }
    return out;
  }

  fetch(manifestUrl, { cache: 'no-store' })
    .then(function (res) {
      if (!res.ok) throw new Error('manifest.json을 찾을 수 없습니다');
      return res.json();
    })
    .then(function (entries) {
      decks = (entries || []).filter(function (d) {
        return d && d.dir && (d.count > 0 || Array.isArray(d.files));
      });
      if (decks.length === 0) {
        statusEl.textContent = emptyText;
        return;
      }
      if (tabsWrap && decks.length > 1) buildTabs();
      showDeck(0);
      statusEl.classList.add('hidden');
      prevBtn.hidden = false;
      nextBtn.hidden = false;
      countEl.hidden = false;
    })
    .catch(function (err) {
      console.error(err);
      statusEl.textContent = '슬라이드를 불러오지 못했습니다: ' + err.message;
    });

  function buildTabs() {
    tabsWrap.hidden = false;
    decks.forEach(function (deck, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'deck-tab' + (i === 0 ? ' active' : '');
      b.textContent = deck.name || deck.dir;
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(tabsWrap.children, function (el, idx) {
          el.classList.toggle('active', idx === i);
        });
        showDeck(i);
      });
      tabsWrap.appendChild(b);
    });
  }

  function showDeck(deckIndex) {
    // 이전 덱의 슬라이드·점을 걷어낸다
    slides.forEach(function (s) { s.remove(); });
    dots.forEach(function (d) { d.remove(); });
    slides = [];
    dots = [];
    current = 0;

    deckImages(decks[deckIndex]).forEach(function (src, i) {
      var section = document.createElement('section');
      section.className = 'slide';

      var img = document.createElement('img');
      img.src = src;
      img.alt = '슬라이드 ' + (i + 1);
      img.loading = i < 2 ? 'eager' : 'lazy';
      section.appendChild(img);

      root.insertBefore(section, prevBtn);
      slides.push(section);

      if (dotsWrap) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'deck-dot' + (i === 0 ? ' active' : '');
        dot.setAttribute('aria-label', '슬라이드 ' + (i + 1) + '로 이동');
        dot.addEventListener('click', (function (idx) {
          return function () { goTo(idx); };
        })(i));
        dotsWrap.appendChild(dot);
        dots.push(dot);
      }
    });

    render();
  }

  function render() {
    slides.forEach(function (s, i) {
      var isCurrent = i === current;
      s.classList.toggle('active', isCurrent);
      s.hidden = !isCurrent;
      s.setAttribute('aria-hidden', String(!isCurrent));
      if (isCurrent) s.setAttribute('aria-current', 'true');
      else s.removeAttribute('aria-current');
    });
    dots.forEach(function (d, i) { d.classList.toggle('active', i === current); });
    if (progressFill) {
      progressFill.style.width = (((current + 1) / slides.length) * 100) + '%';
    }
    countEl.innerHTML = '<b>' + (current + 1) + '</b> / ' + slides.length;
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === slides.length - 1;
  }

  function goTo(index) {
    if (slides.length === 0) return;
    if (index < 0 || index >= slides.length || index === current) return;
    current = index;
    render();
  }

  nextBtn.addEventListener('click', function () { goTo(current + 1); });
  prevBtn.addEventListener('click', function () { goTo(current - 1); });

  if (useKeyboard) {
    window.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goTo(current + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(current - 1); }
    });
  }

  // 터치 스와이프는 덱 안에서만 처리한다(페이지 전체 스와이프를 가로채지 않도록).
  var touchStartX = null;
  root.addEventListener('touchstart', function (e) {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  root.addEventListener('touchend', function (e) {
    if (touchStartX === null) return;
    var dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) goTo(dx < 0 ? current + 1 : current - 1);
    touchStartX = null;
  }, { passive: true });
}
