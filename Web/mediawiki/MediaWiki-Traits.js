(function () {
    'use strict';

    var NARROW_QUERY = '(max-width: 760px)';

    function toArray(list) {
        return Array.prototype.slice.call(list);
    }

    function currentHash() {
        var raw = window.location.hash.replace(/^#/, '');
        try {
            return decodeURIComponent(raw);
        } catch (e) {
            return raw;
        }
    }

    function replaceHash(slug) {
        if (!window.history || !window.history.replaceState) {
            return;
        }
        var url = window.location.pathname + window.location.search + (slug ? '#' + slug : '');
        window.history.replaceState(null, '', url);
    }

    function isNarrow() {
        return !!(window.matchMedia && window.matchMedia(NARROW_QUERY).matches);
    }

    function setup(root) {
        if (root.getAttribute('data-trait-ready')) {
            return;
        }
        root.setAttribute('data-trait-ready', '1');

        var cards = toArray(root.querySelectorAll('.trait-card'));
        var area = root.querySelector('.trait-detail-area');
        var closeButton = root.querySelector('.trait-detail-close');
        var details = {};
        var active = '';

        toArray(root.querySelectorAll('.trait-detail')).forEach(function (detail) {
            details[detail.getAttribute('data-trait')] = detail;
        });

        function close() {
            if (active && details[active]) {
                details[active].classList.remove('is-active');
            }
            cards.forEach(function (card) {
                card.classList.remove('is-active');
            });
            active = '';
            root.classList.remove('has-selection');
            replaceHash('');
        }

        function select(slug, quiet) {
            var detail = details[slug];
            if (!detail) {
                return;
            }
            if (slug === active && !quiet) {
                close();
                return;
            }
            if (active && details[active]) {
                details[active].classList.remove('is-active');
            }
            cards.forEach(function (card) {
                card.classList.toggle('is-active', card.getAttribute('data-trait') === slug);
            });
            detail.classList.add('is-active');
            active = slug;
            root.classList.add('has-selection');
            replaceHash(slug);
            if (isNarrow() && area && area.scrollIntoView) {
                area.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }

        cards.forEach(function (card) {
            card.setAttribute('tabindex', '0');
            card.setAttribute('role', 'button');
            card.addEventListener('click', function () {
                select(card.getAttribute('data-trait'));
            });
            card.addEventListener('keydown', function (event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    select(card.getAttribute('data-trait'));
                }
            });
        });

        if (closeButton) {
            closeButton.setAttribute('role', 'button');
            closeButton.setAttribute('tabindex', '0');
            closeButton.addEventListener('click', close);
            closeButton.addEventListener('keydown', function (event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    close();
                }
            });
        }

        root.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && active) {
                close();
            }
        });

        window.addEventListener('hashchange', function () {
            var slug = currentHash();
            if (details[slug] && slug !== active) {
                select(slug, true);
            }
        });

        if (details[currentHash()]) {
            select(currentHash(), true);
        }
    }

    function init(container) {
        toArray((container || document).querySelectorAll('.trait-browser')).forEach(setup);
    }

    if (window.mw && window.mw.hook) {
        window.mw.hook('wikipage.content').add(function ($content) {
            init($content && $content[0]);
        });
    } else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            init(document);
        });
    } else {
        init(document);
    }
}());
