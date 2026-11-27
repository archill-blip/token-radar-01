// Token Radar Dashboard — app.js, static, no network
(function() {
  'use strict';
  
  // Data from data.js
  var WATCHLIST = typeof WATCHLIST_PROTOCOLS !== 'undefined' ? WATCHLIST_PROTOCOLS : [];
  var EARLY = typeof EARLY_PROTOCOLS !== 'undefined' ? EARLY_PROTOCOLS : [];
  var ALL = WATCHLIST.concat(EARLY);
  
  var boardEl = document.getElementById('board');
  
  // Format helpers
  function formatUSD(v) {
    v = Number(v);
    if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K';
    return v.toFixed(2);
  }
  
  function formatDate(d) {
    if (!d) return '—';
    var date = new Date(d);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  
  // Sort helpers
  function sort(arr, key, desc) {
    var copy = arr.slice();
    copy.sort(function(a, b) {
      var av = a[key], bv = b[key];
      if (desc) return bv - av;
      return av - bv;
    });
    return copy;
  }
  
  // Filter helpers
  function filterTrending(arr) {
    return arr.filter(function(p) {
      return p.change7d !== null && Number(p.change7d) > 10;
    });
  }
  
  function filterCategory(arr, cat) {
    return arr.filter(function(p) { return p.category === cat; });
  }
  
  // Render board
  function renderBoard(container, protocols) {
    if (!container) return;
    container.innerHTML = protocols.map(function(p) {
      var isWatchlist = WATCHLIST.some(function(w) { return w.slug === p.slug; });
      var trending = p.change7d !== null && Number(p.change7d) > 10;
      var changeStr = p.change7d !== null ? Number(p.change7d).toFixed(2) + '%' : '—';
      var changeClass = p.change7d !== null && Number(p.change7d) >= 0 ? 'positive' : 'negative';
      
      var badgeHTML = '';
      if (isWatchlist) badgeHTML += '<span class="badge badge-watchlist">WATCHLIST</span> ';
      if (trending) badgeHTML += '<span class="badge badge-trending">▲ TRENDING</span>';
      
      return ''
        + '<div class="token-card">'
        + '<div class="token-header">'
        + '<span class="symbol">' + escapeHTML(p.name) + '</span>'
        + badgeHTML
        + '</div>'
        + '<div class="token-name">' + escapeHTML(p.slug) + '</div>'
        + '<div class="token-meta">'
        + '<span><strong>TVL</strong> ' + formatUSD(p.tvl) + ' USD</span>'
        + '<span><strong>7d</strong> <span class="' + changeClass + '">' + changeStr + '</span></span>'
        + '</div>'
        + '<div class="token-meta">'
        + '<span><strong>Chains</strong> ' + escapeHTML(p.chains.join(', ')) + '</span>'
        + '<span><strong>Listed</strong> ' + formatDate(p.listedAt) + '</span>'
        + '</div>'
        + '<div class="token-category">' + escapeHTML(p.category || '—') + '</div>'
        + '</div>';
    }).join('');
  }
  
  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  
  // Render detail
  function renderDetail(container, protocol) {
    if (!container || !protocol) return;
    var isWatchlist = WATCHLIST.some(function(w) { return w.slug === protocol.slug; });
    var trending = protocol.change7d !== null && Number(protocol.change7d) > 10;
    
    var badgeHTML = '';
    if (isWatchlist) badgeHTML += '<span class="badge badge-watchlist">WATCHLIST</span> ';
    if (trending) badgeHTML += '<span class="badge badge-trending">▲ TRENDING</span>';
    badgeHTML += '<span class="badge" style="background:#2a2a3e;color:#9898b0;">' + escapeHTML(protocol.category || 'General') + '</span>';
    
    container.innerHTML = ''
      + '<div class="detail-panel">'
      + '<div class="detail-header">'
      + '<h1>' + escapeHTML(protocol.name) + '</h1>'
      + '<div class="detail-slug">' + escapeHTML(protocol.slug) + '</div>'
      + '</div>'
      + '<div class="detail-badge-row">' + badgeHTML + '</div>'
      + '<div class="detail-stats">'
      + '<div class="detail-stat"><div class="stat-label">TVL</div><div class="stat-value">' + formatUSD(protocol.tvl) + ' USD</div></div>'
      + '<div class="detail-stat"><div class="stat-label">7d Change</div><div class="stat-value ' + (protocol.change7d !== null && Number(protocol.change7d) >= 0 ? 'positive' : 'negative') + '">' + (protocol.change7d !== null ? Number(protocol.change7d).toFixed(2) + '%' : 'N/A') + '</div></div>'
      + '<div class="detail-stat"><div class="stat-label">Chains</div><div class="stat-value">' + escapeHTML(protocol.chains.join(', ')) + '</div></div>'
      + '<div class="detail-stat"><div class="stat-label">Category</div><div class="stat-value">' + escapeHTML(protocol.category || '—') + '</div></div>'
      + '<div class="detail-stat"><div class="stat-label">Listed</div><div class="stat-value">' + formatDate(protocol.listedAt) + '</div></div>'
      + '</div>'
      + '<div class="detail-description">'
      + '<h3>About ' + escapeHTML(protocol.name) + '</h3>'
      + '<p>' + escapeHTML(protocol.name) + ' is a ' + escapeHTML(protocol.category || 'DeFi') + ' protocol deployed on ' + escapeHTML(protocol.chains.join(', ')) + '. '
      + (protocol.change7d !== null ? 'Its TVL changed ' + Number(protocol.change7d).toFixed(2) + '% over the last 7 days.' : 'TVL change data is not available.') + '</p>'
      + '<h3>Farm Strategy</h3>'
      + '<ol>'
      + '<li><strong>Research</strong> — Verify ' + escapeHTML(protocol.slug) + ' on DefiLlama and official channels</li>'
      + '<li><strong>Monitor</strong> — Track TVL weekly; watch for growth above ' + formatUSD(Math.floor(Number(protocol.tvl) * 1.2)) + ' USD</li>'
      + '<li><strong>Community</strong> — Join Discord/Telegram/X from official protocol page for launch signals</li>'
      + '<li><strong>Prepare</strong> — Set up ' + (protocol.chains[0] || 'the main chain') + ' wallet with sufficient balance</li>'
      + '<li><strong>Interact</strong> — Use protocol before token launch to build airdrop-eligible history</li>'
      + '<li><strong>Wait</strong> — Verify token contract on-chain before claiming, never click unsolicited links</li>'
      + '<li><strong>Claim</strong> — Check vesting schedule and consider holding long-term</li>'
      + '</ol>'
      + '</div>'
      + '</div>';
  }
  
  // Show view
  function showView(view) {
    if (!boardEl) return;
    
    if (view === 'board') {
      var sorted = sort(ALL, 'tvl', true);
      renderBoard(boardEl, sorted);
    } else if (view === 'detail') {
      var top = sort(ALL, 'tvl', true)[0];
      renderDetail(boardEl, top);
    } else if (view === 'filtered') {
      var trending = filterTrending(ALL);
      var filtered = trending.length > 0 ? trending : sort(ALL, 'change7d', true).slice(0, 30);
      renderBoard(boardEl, filtered);
    }
  }
  
  // Init
  if (boardEl) {
    // Stats
    var totalTVL = ALL.reduce(function(s, p) { return s + Number(p.tvl) || 0; }, 0);
    var totalWatchlist = WATCHLIST.length;
    var trendingCount = filterTrending(ALL).length;
    
    var statsBar = document.querySelector('.stats-bar') || document.createElement('div');
    if (!statsBar.classList.contains('stats-bar')) {
      statsBar.className = 'stats-bar';
      statsBar.innerHTML = ''
        + '<div class="stat"><div class="stat-label">Total TVL</div><div class="stat-value">' + formatUSD(totalTVL) + '</div></div>'
        + '<div class="stat"><div class="stat-label">Watchlist</div><div class="stat-value">' + totalWatchlist + '</div></div>'
        + '<div class="stat"><div class="stat-label">Trending</div><div class="stat-value">' + trendingCount + '</div></div>'
        + '<div class="stat"><div class="stat-label">Protocols</div><div class="stat-value">' + ALL.length + '</div></div>';
      document.querySelector('.header').after(statsBar);
    }
    
    // Navigation
    var nav = document.querySelector('.nav') || document.createElement('div');
    if (!nav.classList.contains('nav')) {
      nav.className = 'nav';
      nav.innerHTML = ''
        + '<button class="nav-btn active" data-view="board">📊 Board</button>'
        + '<button class="nav-btn" data-view="detail">🔍 Detail</button>'
        + '<button class="nav-btn" data-view="filtered">🔎 Filtered</button>';
      document.querySelector('.filter-bar')?.after(nav) || document.querySelector('.stats-bar')?.after(nav) || document.querySelector('.header')?.after(nav);
    }
    
    // Navigation handlers
    nav.querySelectorAll('.nav-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        nav.querySelectorAll('.nav-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        showView(btn.dataset.view);
      });
    });
    
    // Filter bar
    var filterBar = document.querySelector('.filter-bar') || document.createElement('div');
    if (!filterBar.classList.contains('filter-bar')) {
      filterBar.className = 'filter-bar';
      filterBar.innerHTML = ''
        + '<span class="filter-label">Sort:</span>'
        + '<select class="filter-select" id="f-sort">'
        + '<option value="tvl">TVL (high first)</option>'
        + '<option value="change7d">7d Growth</option>'
        + '<option value="name">Name (A-Z)</option>'
        + '</select>'
        + '<span class="filter-label">Category:</span>'
        + '<select class="filter-select" id="f-category">'
        + '<option value="">All</option>'
        + '<option value="Dexs">Dexs</option>'
        + '<option value="Lending">Lending</option>'
        + '<option value="Bridge">Bridge</option>'
        + '<option value="Liquid Staking">Liquid Staking</option>'
        + '<option value="Insurance">Insurance</option>'
        + '<option value="Yield">Yield</option>'
        + '</select>'
        + '<label class="filter-label"><input type="checkbox" id="f-trending"> Trending only</label>';
      nav.after(filterBar);
    }
    
    // Filter handlers
    var sortSelect = document.getElementById('f-sort');
    var catSelect = document.getElementById('f-category');
    var trendCheck = document.getElementById('f-trending');
    
    if (sortSelect) sortSelect.addEventListener('change', applyFilters);
    if (catSelect) catSelect.addEventListener('change', applyFilters);
    if (trendCheck) trendCheck.addEventListener('change', applyFilters);
    
    function applyFilters() {
      var sortKey = sortSelect ? sortSelect.value : 'tvl';
      var category = catSelect ? catSelect.value : '';
      var trendingOnly = trendCheck ? trendCheck.checked : false;
      
      var filtered = ALL;
      if (trendingOnly) filtered = filterTrending(filtered);
      if (category) filtered = filterCategory(filtered, category);
      
      // Sort
      if (sortKey === 'name') {
        filtered.sort(function(a, b) { return a.name.localeCompare(b.name); });
      } else {
        filtered.sort(function(a, b) { return Number(b[sortKey]) - Number(a[sortKey]); });
      }
      
      renderBoard(boardEl, filtered);
    }
    
    // Initial render
    showView('board');
  }
})();
