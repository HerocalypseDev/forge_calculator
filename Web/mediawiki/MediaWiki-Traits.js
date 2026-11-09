(function () {
    'use strict';

    var NARROW_QUERY = '(max-width: 1000px)';

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
        var closeButtons = toArray(root.querySelectorAll('.trait-detail-close'));
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
            card.addEventListener('click', function (event) {
                event.preventDefault();
                select(card.getAttribute('data-trait'));
            });
            card.addEventListener('keydown', function (event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    select(card.getAttribute('data-trait'));
                }
            });
        });

        closeButtons.forEach(function (button) {
            button.setAttribute('role', 'button');
            button.setAttribute('tabindex', '0');
            button.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                close();
            });
            button.addEventListener('keydown', function (event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    close();
                }
            });
        });

        var filterRow = root.querySelector('.trait-filters');
        var leftArrow = root.querySelector('.trait-filter-arrow.is-left');
        var rightArrow = root.querySelector('.trait-filter-arrow.is-right');

        function updateArrows() {
            if (!filterRow || !leftArrow || !rightArrow) {
                return;
            }
            var bar = filterRow.parentNode;
            bar.classList.toggle('has-overflow', filterRow.scrollWidth > bar.clientWidth + 1);
            var maxScroll = filterRow.scrollWidth - filterRow.clientWidth;
            leftArrow.classList.toggle('is-hidden', filterRow.scrollLeft <= 1);
            rightArrow.classList.toggle('is-hidden', filterRow.scrollLeft >= maxScroll - 1);
        }

        function scrollFilters(direction) {
            var maxScroll = Math.max(0, filterRow.scrollWidth - filterRow.clientWidth);
            var step = Math.max(120, filterRow.clientWidth * 0.6);
            var current = Math.min(maxScroll, Math.max(0, filterRow.scrollLeft));
            var target = Math.min(maxScroll, Math.max(0, current + step * direction));
            var snap = step / 2;
            if (target < snap) {
                target = 0;
            }
            if (maxScroll - target < snap) {
                target = maxScroll;
            }
            if (filterRow.scrollTo) {
                filterRow.scrollTo({ left: target, behavior: 'smooth' });
            } else {
                filterRow.scrollLeft = target;
            }
        }

        if (filterRow && leftArrow && rightArrow) {
            leftArrow.setAttribute('role', 'button');
            rightArrow.setAttribute('role', 'button');
            leftArrow.addEventListener('click', function () {
                scrollFilters(-1);
            });
            rightArrow.addEventListener('click', function () {
                scrollFilters(1);
            });
            filterRow.addEventListener('scroll', updateArrows);
            window.addEventListener('resize', updateArrows);
            if (window.ResizeObserver) {
                new window.ResizeObserver(updateArrows).observe(filterRow);
            }
            updateArrows();
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
