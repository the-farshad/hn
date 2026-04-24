(function () {
  const API = 'https://hn.algolia.com/api/v1';
  const PAGE_SIZE = 30;
  const list = document.getElementById('story-list');
  const status = document.getElementById('status');
  const buttons = document.querySelectorAll('.toolbar button[data-feed]');

  function setStatus(msg, isError) {
    status.textContent = msg || '';
    status.className = 'status' + (isError ? ' error' : '');
    status.style.display = msg ? 'block' : 'none';
  }

  function host(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch { return ''; }
  }

  function timeAgo(unixSeconds) {
    const diff = Math.floor(Date.now() / 1000) - unixSeconds;
    const units = [
      [60, 'second'],
      [3600, 'minute', 60],
      [86400, 'hour', 3600],
      [2592000, 'day', 86400],
      [31536000, 'month', 2592000],
      [Infinity, 'year', 31536000],
    ];
    for (const [limit, label, divisor] of units) {
      if (diff < limit) {
        const n = Math.max(1, Math.floor(diff / (divisor || 1)));
        return n + ' ' + label + (n === 1 ? '' : 's') + ' ago';
      }
    }
    return '';
  }

  function render(hits) {
    list.innerHTML = '';
    for (const hit of hits) {
      if (!hit.title) continue;
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
            ' &middot; <a href="https://news.ycombinator.com/item?id=' + hit.objectID +
              '" target="_blank" rel="noopener">' + (hit.num_comments || 0) + ' comments</a>' +
          '</div>' +
        '</div>';
      list.appendChild(li);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  async function load(feed) {
    setStatus('Loading...', false);
    list.innerHTML = '';
    const tag = feed === 'new' ? 'story' : 'front_page';
    const path = feed === 'new' ? 'search_by_date' : 'search';
    const url = API + '/' + path + '?tags=' + tag + '&hitsPerPage=' + PAGE_SIZE;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (!data.hits || data.hits.length === 0) {
        setStatus('No stories found.', false);
        return;
      }
      render(data.hits);
      setStatus('', false);
    } catch (err) {
      setStatus('Could not load stories: ' + err.message, true);
    }
  }

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      load(btn.dataset.feed);
    });
  });

  load('top');
})();
