(function () {
  const API = 'https://hn.algolia.com/api/v1';
  const PAGE_SIZE = 30;
  const BM_KEY = 'hn-bookmarks';

  const listView = document.getElementById('list-view');
  const itemView = document.getElementById('item-view');
  const list = document.getElementById('story-list');
  const status = document.getElementById('status');
  const loadMoreBtn = document.getElementById('load-more');
  const feedButtons = document.querySelectorAll('.toolbar button[data-feed]');

  const state = { feed: 'top', page: 0, exhausted: false, loading: false };

  // ---------- helpers ----------

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function host(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch { return ''; }
  }

  function timeAgo(unixSeconds) {
    if (!unixSeconds) return '';
    const diff = Math.floor(Date.now() / 1000) - unixSeconds;
    const units = [
      [60, 'second', 1],
      [3600, 'minute', 60],
      [86400, 'hour', 3600],
      [2592000, 'day', 86400],
      [31536000, 'month', 2592000],
      [Infinity, 'year', 31536000],
    ];
    for (const [limit, label, divisor] of units) {
      if (diff < limit) {
        const n = Math.max(1, Math.floor(diff / divisor));
        return n + ' ' + label + (n === 1 ? '' : 's') + ' ago';
      }
    }
    return '';
  }

  function setStatus(msg, isError) {
    if (!msg) { status.style.display = 'none'; status.textContent = ''; return; }
    status.style.display = 'block';
    status.textContent = msg;
    status.className = 'status' + (isError ? ' error' : '');
  }

  function show(view) {
    listView.style.display = view === 'list' ? '' : 'none';
    itemView.style.display = view === 'item' ? '' : 'none';
    window.scrollTo(0, 0);
  }

  // ---------- bookmarks ----------

  function getBookmarks() {
    try {
      const raw = localStorage.getItem(BM_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }

  function setBookmarks(arr) {
    try { localStorage.setItem(BM_KEY, JSON.stringify(arr)); }
    catch (e) {}
  }

  function isBookmarked(id) {
    return getBookmarks().some(b => String(b.id) === String(id));
  }

  function toggleBookmark(snapshot) {
    const id = String(snapshot.id);
    const arr = getBookmarks();
    const idx = arr.findIndex(b => String(b.id) === id);
    if (idx >= 0) {
      arr.splice(idx, 1);
    } else {
      arr.unshift(Object.assign({}, snapshot, { savedAt: Math.floor(Date.now() / 1000) }));
    }
    setBookmarks(arr);
    refreshBookmarkButtons(id);
  }

  function refreshBookmarkButtons(id) {
    const saved = isBookmarked(id);
    document.querySelectorAll('.bookmark-btn[data-id="' + id + '"]').forEach(btn => {
      btn.classList.toggle('active', saved);
      btn.setAttribute('aria-pressed', saved ? 'true' : 'false');
      btn.title = saved ? 'Remove bookmark' : 'Bookmark';
      btn.textContent = saved ? '★' : '☆';
    });
  }

  function snapshotFromHit(hit) {
    return {
      id: hit.objectID,
      title: hit.title,
      url: hit.url || null,
      author: hit.author || null,
      points: hit.points || 0,
      created_at_i: hit.created_at_i || null,
      num_comments: hit.num_comments || 0,
    };
  }

  function snapshotFromItem(item) {
    return {
      id: item.id,
      title: item.title,
      url: item.url || null,
      author: item.author || null,
      points: item.points || 0,
      created_at_i: item.created_at_i || null,
      num_comments: countComments(item.children),
    };
  }

  function countComments(children) {
    if (!children) return 0;
    let n = 0;
    for (const c of children) n += 1 + countComments(c.children);
    return n;
  }

  // ---------- list view rendering ----------

  function bookmarkButtonHtml(snapshot) {
    const saved = isBookmarked(snapshot.id);
    const id = escapeHtml(String(snapshot.id));
    const dataAttr = escapeHtml(JSON.stringify(snapshot));
    return (
      '<button type="button" class="bookmark-btn' + (saved ? ' active' : '') + '"' +
        ' data-id="' + id + '" data-snap="' + dataAttr + '"' +
        ' title="' + (saved ? 'Remove bookmark' : 'Bookmark') + '"' +
        ' aria-pressed="' + (saved ? 'true' : 'false') + '">' +
        (saved ? '★' : '☆') +
      '</button>'
    );
  }

  function renderStorySnapshot(s) {
    const url = s.url || ('https://news.ycombinator.com/item?id=' + s.id);
    const h = host(s.url);
    const li = document.createElement('li');
    li.className = 'story';
    li.innerHTML =
      '<div class="story-main">' +
        '<a class="story-title" href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' +
          escapeHtml(s.title || '(no title)') +
        '</a>' +
        (h ? '<span class="story-host">(' + escapeHtml(h) + ')</span>' : '') +
        '<div class="story-meta">' +
          (s.points || 0) + ' points by ' + escapeHtml(s.author || 'unknown') +
          (s.created_at_i ? ' &middot; ' + timeAgo(s.created_at_i) : '') +
          ' &middot; <a href="#item/' + encodeURIComponent(s.id) + '">' +
            (s.num_comments || 0) + ' comments</a>' +
        '</div>' +
      '</div>' +
      '<div class="story-actions">' + bookmarkButtonHtml(s) + '</div>';
    return li;
  }

  function loadSaved() {
    list.innerHTML = '';
    loadMoreBtn.style.display = 'none';
    const saved = getBookmarks();
    if (saved.length === 0) {
      setStatus('No bookmarks yet. Tap the ☆ on any story to save it here.');
      return;
    }
    saved.forEach(s => list.appendChild(renderStorySnapshot(s)));
    setStatus('');
  }

  async function loadMore() {
    if (state.feed === 'saved') return;
    if (state.loading || state.exhausted) return;
    state.loading = true;
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = 'Loading...';
    if (state.page === 0) setStatus('Loading...');

    const tag = state.feed === 'new' ? 'story' : 'front_page';
    const path = state.feed === 'new' ? 'search_by_date' : 'search';
    const url = API + '/' + path + '?tags=' + tag +
                '&hitsPerPage=' + PAGE_SIZE + '&page=' + state.page;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const hits = (data.hits || []).filter(h => h.title);

      if (state.page === 0 && hits.length === 0) {
        setStatus('No stories found.');
        return;
      }

      hits.forEach(hit => list.appendChild(renderStorySnapshot(snapshotFromHit(hit))));

      if (hits.length < PAGE_SIZE || state.page + 1 >= (data.nbPages || 0)) {
        state.exhausted = true;
        loadMoreBtn.style.display = 'none';
      } else {
        loadMoreBtn.style.display = '';
      }
      state.page += 1;
      setStatus('');
    } catch (err) {
      setStatus('Could not load stories: ' + err.message, true);
    } finally {
      state.loading = false;
      loadMoreBtn.disabled = false;
      loadMoreBtn.textContent = 'Load more';
    }
  }

  function loadFeed(feed) {
    state.feed = feed;
    state.page = 0;
    state.exhausted = false;
    list.innerHTML = '';
    loadMoreBtn.style.display = 'none';
    if (feed === 'saved') loadSaved();
    else loadMore();
  }

  // ---------- item / comments view ----------

  function renderComment(node, depth) {
    if (!node) return '';
    const author = node.author ? escapeHtml(node.author) : '[deleted]';
    const meta = author + (node.created_at_i ? ' &middot; ' + timeAgo(node.created_at_i) : '');
    const body = node.text || '';
    const children = (node.children || [])
      .map(c => renderComment(c, depth + 1))
      .join('');
    const cls = 'comment depth-' + Math.min(depth, 8);
    return (
      '<li class="' + cls + '">' +
        '<div class="comment-meta">' + meta + '</div>' +
        (body ? '<div class="comment-body">' + body + '</div>' : '') +
        (children ? '<ul class="comment-children">' + children + '</ul>' : '') +
      '</li>'
    );
  }

  async function loadItem(id) {
    show('item');
    itemView.innerHTML = '<div class="status">Loading thread...</div>';
    try {
      const res = await fetch(API + '/items/' + encodeURIComponent(id));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const item = await res.json();

      const snap = snapshotFromItem(item);
      const title = escapeHtml(item.title || '(no title)');
      const targetUrl = item.url || ('https://news.ycombinator.com/item?id=' + item.id);
      const h = host(item.url);
      const meta =
        (item.points || 0) + ' points by ' + escapeHtml(item.author || 'unknown') +
        (item.created_at_i ? ' &middot; ' + timeAgo(item.created_at_i) : '');
      const text = item.text ? '<div class="story-text">' + item.text + '</div>' : '';
      const comments = (item.children || [])
        .map(c => renderComment(c, 0))
        .join('');

      itemView.innerHTML =
        '<a class="back-to-list" href="#">&larr; back to stories</a>' +
        '<article class="thread">' +
          '<div class="thread-head">' +
            '<h2 class="thread-title">' +
              '<a href="' + escapeHtml(targetUrl) + '" target="_blank" rel="noopener">' + title + '</a>' +
              (h ? ' <span class="story-host">(' + escapeHtml(h) + ')</span>' : '') +
            '</h2>' +
            '<div class="thread-actions">' + bookmarkButtonHtml(snap) + '</div>' +
          '</div>' +
          '<div class="thread-meta">' + meta + '</div>' +
          text +
          (comments
            ? '<ul class="comment-thread">' + comments + '</ul>'
            : '<div class="status">No comments yet.</div>') +
        '</article>';
    } catch (err) {
      itemView.innerHTML =
        '<a class="back-to-list" href="#">&larr; back to stories</a>' +
        '<div class="status error">Could not load thread: ' + escapeHtml(err.message) + '</div>';
    }
  }

  // ---------- routing ----------

  function route() {
    const m = (location.hash || '').match(/^#item\/(\d+)/);
    if (m) loadItem(m[1]);
    else show('list');
  }

  // ---------- wire up ----------

  feedButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (location.hash) {
        history.replaceState(null, '', location.pathname + location.search);
      }
      feedButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      show('list');
      loadFeed(btn.dataset.feed);
    });
  });

  loadMoreBtn.addEventListener('click', loadMore);

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.bookmark-btn');
    if (!btn) return;
    e.preventDefault();
    try {
      const snap = JSON.parse(btn.dataset.snap);
      toggleBookmark(snap);
      if (state.feed === 'saved') {
        const li = btn.closest('li.story');
        if (li && !isBookmarked(snap.id)) li.remove();
        if (list.children.length === 0) {
          setStatus('No bookmarks yet. Tap the ☆ on any story to save it here.');
        }
      }
    } catch {}
  });

  window.addEventListener('hashchange', route);

  loadFeed('top');
  if (location.hash) route();
})();
