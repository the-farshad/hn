(function () {
  const API = 'https://hn.algolia.com/api/v1';
  const PAGE_SIZE = 30;

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

  // ---------- list view ----------

  function renderStory(hit, index) {
    const url = hit.url || ('https://news.ycombinator.com/item?id=' + hit.objectID);
    const h = host(hit.url);
    const li = document.createElement('li');
    li.className = 'story';
    li.innerHTML =
      '<div>' +
        '<a class="story-title" href="' + url + '" target="_blank" rel="noopener">' +
          escapeHtml(hit.title) +
        '</a>' +
        (h ? '<span class="story-host">(' + escapeHtml(h) + ')</span>' : '') +
        '<div class="story-meta">' +
          (hit.points || 0) + ' points by ' + escapeHtml(hit.author || 'unknown') +
          ' &middot; ' + timeAgo(hit.created_at_i) +
          ' &middot; <a href="#item/' + hit.objectID + '">' +
            (hit.num_comments || 0) + ' comments</a>' +
        '</div>' +
      '</div>';
    return li;
  }

  async function loadMore() {
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

      const start = state.page * PAGE_SIZE;
      hits.forEach((hit, i) => list.appendChild(renderStory(hit, start + i)));

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
    loadMore();
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
          '<h2 class="thread-title">' +
            '<a href="' + targetUrl + '" target="_blank" rel="noopener">' + title + '</a>' +
            (h ? ' <span class="story-host">(' + escapeHtml(h) + ')</span>' : '') +
          '</h2>' +
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
    if (m) {
      loadItem(m[1]);
    } else {
      show('list');
    }
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

  window.addEventListener('hashchange', route);

  // initial
  loadFeed('top');
  if (location.hash) route();
})();
