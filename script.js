/* ============================================
   张齐平 · 在线简历 - 交互脚本
   功能：导航、滚动监听、滚动显现动画、技能条动画、
         平滑滚动、移动端菜单、返回顶部
   ============================================ */
(function () {
    'use strict';

    /* ---------- 工具函数 ---------- */
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

    // 节流
    function throttle(fn, wait = 100) {
        let last = 0, timer = null;
        return function (...args) {
            const now = Date.now();
            const remaining = wait - (now - last);
            if (remaining <= 0) {
                clearTimeout(timer);
                timer = null;
                last = now;
                fn.apply(this, args);
            } else if (!timer) {
                timer = setTimeout(() => {
                    last = Date.now();
                    timer = null;
                    fn.apply(this, args);
                }, remaining);
            }
        };
    }

    /* ---------- DOM Ready ---------- */
    document.addEventListener('DOMContentLoaded', init);

    /* ---------- 技能栏背景轮播（两张图片左划切换，3s 间隔 + 高斯模糊） ---------- */
    function initSkillsSlider() {
        const slider = document.querySelector('.skills-bg-slider');
        if (!slider) return;
        const track = slider.querySelector('.skills-bg-track');
        const slides = Array.from(slider.querySelectorAll('.skills-bg-slide'));
        if (slides.length !== 2) return;

        // 预加载图片，避免首次切换时的闪烁
        slides.forEach((s) => {
            const match = s.style.backgroundImage && s.style.backgroundImage.match(/url\(['"]?(.+?)['"]?\)/);
            if (match && match[1]) {
                const pre = new Image();
                pre.src = match[1];
            }
        });

        // 收集每张图片的 URL，然后按顺序循环 [img1, img2, img1, img2, ...]
        const urls = slides.map((s) => {
            const match = s.style.backgroundImage && s.style.backgroundImage.match(/url\(['"]?(.+?)['"]?\)/);
            return match ? match[1] : '';
        }).filter(Boolean);
        if (urls.length < 2) return;

        let currentIdx = 0; // 当前显示的图片索引（在 urls 数组中的位置）

        function updateSlidesForNext(nextIdx) {
            // 左侧：当前图片；右侧：下一张图片
            const leftUrl = urls[currentIdx % urls.length];
            const rightUrl = urls[nextIdx % urls.length];
            slides[0].style.backgroundImage = `url('${leftUrl}')`;
            slides[1].style.backgroundImage = `url('${rightUrl}')`;
        }

        function animateToNext() {
            const nextIdx = (currentIdx + 1) % urls.length;
            // 1) 先把左右两格放好：当前图片在左，下一张在右，位置归 0
            track.style.transition = 'none';
            track.style.transform = 'translateX(0)';
            // 强制重新计算布局，让浏览器接受 transition 的瞬时清除
            // eslint-disable-next-line no-unused-expressions
            track.offsetWidth;
            updateSlidesForNext(nextIdx);
            // 2) 触发左划动画：平移到 -50%
            // 用 requestAnimationFrame 让下一帧才开始动画，避免被忽略
            requestAnimationFrame(() => {
                track.style.transition = 'transform 0.7s cubic-bezier(0.65, 0, 0.35, 1)';
                track.style.transform = 'translateX(-50%)';
            });
            currentIdx = nextIdx;
        }

        // 初始状态：左侧显示 urls[0]，右侧显示 urls[1]，位置在 0（显示左侧）
        track.style.transition = 'none';
        track.style.transform = 'translateX(0)';
        slides[0].style.backgroundImage = `url('${urls[0]}')`;
        slides[1].style.backgroundImage = `url('${urls[1]}')`;

        // 使用 IntersectionObserver：只有当栏目进入视口才运行轮播，节省资源
        let timerId = null;
        let isRunning = false;

        function start() {
            if (isRunning) return;
            isRunning = true;
            timerId = setInterval(animateToNext, 3000);
        }

        function stop() {
            if (!isRunning) return;
            isRunning = false;
            if (timerId) clearInterval(timerId);
            timerId = null;
        }

        if ('IntersectionObserver' in window) {
            const io = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) start();
                    else stop();
                });
            }, { threshold: 0.05 });
            io.observe(slider);
        } else {
            start();
        }

        // 页面隐藏时暂停
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) stop();
        });
    }

    /* ---------- 头像：使用项目文件夹下的照片，多扩展名自动回退 ---------- */
    function initAvatar() {
        const img = document.querySelector('.hero-visual img.avatar');
        if (!img) return;

        const fallback = img.nextElementSibling; // .avatar-fallback

        // --- 解析回退链（例如 ["avatar.png","avatar.jpeg","avatar.svg"]）
        let fallbacks = [];
        try {
            const raw = img.getAttribute('data-fallback');
            if (raw) fallbacks = JSON.parse(raw);
        } catch (_) { }
        let idx = 0;

        img.addEventListener('error', function onError() {
            if (idx < fallbacks.length) {
                img.src = fallbacks[idx++];
            } else {
                img.style.display = 'none';
                if (fallback) fallback.classList.add('show');
                img.removeEventListener('error', onError);
            }
        });
        img.addEventListener('load', function onLoad() {
            img.style.display = 'block';
            if (fallback) fallback.classList.remove('show');
        });
    }

    /* ---------- 教育栏目背景轮播（5秒交叉淡入淡出，仅 section 进入视口时运行） ---------- */
    function initEducationSlider() {
        const slider = document.querySelector('.edu-bg-slider');
        if (!slider) return;
        const slides = Array.from(slider.querySelectorAll('.edu-bg-slide'));
        if (slides.length < 2) return;

        const INTERVAL_MS = 5000;
        let currentIdx = 0;
        let timerId = null;
        let isRunning = false;

        // 预加载图片（减少首帧之外的图片在后台提前获取，避免首次切换时闪白）
        slides.forEach((s) => {
            const url = s.style.backgroundImage;
            const m = url && url.match(/url\(['"]?(.+?)['"]?\)/);
            if (!m) return;
            const pre = new Image();
            pre.src = m[1];
        });

        function show(nextIdx) {
            if (nextIdx === currentIdx) return;
            slides[currentIdx].classList.remove('is-active');
            slides[nextIdx].classList.add('is-active');
            currentIdx = nextIdx;
        }

        function start() {
            if (isRunning) return;
            isRunning = true;
            timerId = setInterval(() => show((currentIdx + 1) % slides.length), INTERVAL_MS);
        }

        function stop() {
            if (!isRunning) return;
            isRunning = false;
            if (timerId) clearInterval(timerId);
            timerId = null;
        }

        // 用 IntersectionObserver 让轮播只在进入视口时运行，节省性能
        if ('IntersectionObserver' in window) {
            const io = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) start();
                    else stop();
                });
            }, { threshold: 0.05 });
            io.observe(slider);
        } else {
            start();
        }

        // 页面隐藏时暂停（省电）
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) stop();
            else {
            }
        });

        // 窗口尺寸变化时让当前图片重新 cover 铺满（浏览器会自动完成）
        // 此处无需额外处理，但在移动端进一步调优：
        window.addEventListener('resize', () => {
            // 无额外 JS resize 时，重新将当前 slide 触发一次 reflow，无需处理
        });
    }

    function init() {
        initSkillsSlider();
        initAvatar();
        initEducationSlider();
        initSnapController();       // 先启用磁吸控制器（供 initSmoothScroll 调用）
        initNavbar();
        initMobileMenu();
        initSmoothScroll();
        initScrollReveal();
        initRadar();
        initBackToTop();
        // initActiveNavLink 由磁吸控制器接管（snapTo 时实时更新）
    }

    /* ---------- 导航栏滚动样式 ---------- */
    function initNavbar() {
        const navbar = $('#navbar');
        if (!navbar) return;

        const onScroll = throttle(() => {
            if (window.scrollY > 40) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        }, 80);

        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    /* ---------- 移动端菜单切换 ---------- */
    function initMobileMenu() {
        const toggle = $('#navToggle');
        const menu = $('.nav-menu');
        if (!toggle || !menu) return;

        toggle.addEventListener('click', () => {
            const isActive = toggle.classList.toggle('active');
            menu.classList.toggle('active');
            toggle.setAttribute('aria-expanded', String(isActive));
        });

        // 点击菜单项后自动关闭
        $$('.nav-link', menu).forEach(link => {
            link.addEventListener('click', () => {
                toggle.classList.remove('active');
                menu.classList.remove('active');
                toggle.setAttribute('aria-expanded', 'false');
            });
        });

        // 点击外部关闭
        document.addEventListener('click', (e) => {
            if (!menu.contains(e.target) && !toggle.contains(e.target) && menu.classList.contains('active')) {
                toggle.classList.remove('active');
                menu.classList.remove('active');
                toggle.setAttribute('aria-expanded', 'false');
            }
        });

        // ESC 关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && menu.classList.contains('active')) {
                toggle.classList.remove('active');
                menu.classList.remove('active');
                toggle.setAttribute('aria-expanded', 'false');
                toggle.focus();
            }
        });
    }

    /* ============================================================
       自定义磁吸控制器 (Custom Snap Controller)
       ------------------------------------------------------------
       功能：
         1) 短距离滚动 → 自动回弹到当前栏目
         2) 达到阈值滚动 → 平滑切换到目标栏目
         3) 可配置阈值参数（分桌面/平板/移动端）
         4) requestAnimationFrame + 贝塞尔缓动动画
         5) 跨设备一致体验（桌面/平板/移动端自动识别）
         6) 顶部/底部边界保护

       状态机：
         idle ──滚动输入──► armed(记录起点) ──停止输入──► decide(判定方向+距离)
         ├─ < threshold  ─► rebound(回弹到 currentIndex)
         └─ >= threshold ─► switch(切换到 next/prev 栏目)
         动画期间：isSnapping=true，忽略用户输入，避免叠加
       ============================================================ */

    function initSnapController() {
        // ------ 1) 栏目收集 ------
        // hero + 所有 section = 完整栏目列表
        const sectionSelectors = 'header.hero, main .section';
        let sections = $$(sectionSelectors);

        if (!sections.length) return;

        // ------ 2) 可配置参数（用户可在此调整手感） ------
        // switchThreshold: 触发栏目切换的滚动距离（相对当前视口高度的比例）
        // snapDuration:    切换栏目时动画时长 (ms)
        // reboundDuration: 回弹动画时长 (ms)
        // settleMs:        用户停止输入多少 ms 后判定"已停止"
        const CONFIG = {
            desktop: { switchThreshold: 0.30, snapDuration: 850, reboundDuration: 420, settleMs: 140 },
            tablet: { switchThreshold: 0.35, snapDuration: 750, reboundDuration: 380, settleMs: 140 },
            mobile: { switchThreshold: 0.50, snapDuration: 650, reboundDuration: 340, settleMs: 160 }
        };

        // 当前生效配置（由响应式监听更新）
        let activeCfg = CONFIG.desktop;
        let isMobileSnapEnabled = false; // 桌面才启用，移动端走普通滚动

        // ------ 3) 运行时状态 ------
        let sectionTops = [];       // 每个栏目到文档顶部的绝对 Y 位置
        let currentIndex = 0;       // 当前吸附到的栏目索引
        let isSnapping = false;     // 是否在吸附动画中（动画期间忽略用户滚动输入）
        let rafId = null;           // 当前 rAF 动画 id，用于取消
        let settleTimer = null;     // 用户停止输入的判定定时器

        // 滚动起点 & 意图
        let armedScrollY = 0;       // 最近一次滚动输入开始时的 scrollY
        let lastInputTime = 0;      // 最近一次输入时间戳
        let lastInputDelta = 0;     // 最近一次输入的方向累计（用于惯性估算）

        // 触控状态
        let touchStartY = 0;
        let touchLastY = 0;
        let touchStartTime = 0;

        // ------ 4) 计算栏目顶部位置 ------
        // 顶部对齐到视口顶部（考虑 navbar 高度）。
        function computeSectionTops() {
            const navbarH = ($('.navbar')?.offsetHeight || 0);
            sectionTops = sections.map((sec) => {
                const rect = sec.getBoundingClientRect();
                // rect.top 是相对视口的偏移 + 当前 scrollY = 文档绝对位置
                return Math.round(rect.top + window.scrollY);
            });
            // 边界：第一个栏目固定为 0（避免 navbar 在 hero 上的微小偏移）
            if (sectionTops.length > 0) sectionTops[0] = 0;
        }

        // ------ 5) 辅助：计算可滚动的最大位置（边界保护） ------
        function getMaxScrollY() {
            const doc = document.documentElement;
            const body = document.body;
            const maxY = Math.max(
                doc.scrollHeight - doc.clientHeight,
                body.scrollHeight - body.clientHeight,
                0
            );
            return maxY;
        }

        // ------ 6) 吸附到指定栏目索引 ------
        function snapTo(index, opts = {}) {
            if (index < 0) index = 0;
            if (index >= sections.length) index = sections.length - 1;

            const targetY = Math.min(sectionTops[index], getMaxScrollY());
            const currentY = window.scrollY;
            const distance = targetY - currentY;

            if (Math.abs(distance) < 1) {
                currentIndex = index;
                updateActiveNav();
                updateIndicator();
                return;
            }

            // 动画时长：优先用外部传入，否则按类型取配置
            const type = opts.type || (opts.durationMs ? 'custom' :
                (Math.abs(distance) > window.innerHeight * activeCfg.switchThreshold ? 'switch' : 'rebound'));
            const duration = opts.durationMs
                || (type === 'rebound' ? activeCfg.reboundDuration : activeCfg.snapDuration);

            animateScrollTo(targetY, duration);
            currentIndex = index;
            updateActiveNav();
            updateIndicator();
        }

        // ------ 7) requestAnimationFrame + cubic-bezier 平滑动画 ------
        // 使用 easeOutCubic：先快后慢，符合"沉稳"的手感
        function easeOutCubic(t) {
            return 1 - Math.pow(1 - t, 3);
        }

        function animateScrollTo(targetY, duration) {
            // 取消已有动画
            if (rafId) cancelAnimationFrame(rafId);

            const startY = window.scrollY;
            const delta = targetY - startY;
            const startTime = performance.now();

            isSnapping = true;
            document.documentElement.classList.add('is-snapping');

            function step(now) {
                const elapsed = now - startTime;
                const t = Math.min(elapsed / duration, 1);
                const eased = easeOutCubic(t);
                const nextY = startY + delta * eased;

                window.scrollTo(0, nextY);

                if (t < 1 && Math.abs(targetY - window.scrollY) > 0.5) {
                    rafId = requestAnimationFrame(step);
                } else {
                    // 精确落到目标位置
                    if (window.scrollY !== targetY) {
                        window.scrollTo(0, targetY);
                    }
                    rafId = null;
                    isSnapping = false;
                    document.documentElement.classList.remove('is-snapping');
                }
            }

            rafId = requestAnimationFrame(step);
        }

        // ------ 8) 更新导航高亮 & 右侧指示器 ------
        function updateActiveNav() {
            const id = sections[currentIndex]?.id;
            if (!id) return;

            $$('.nav-link').forEach(a => {
                a.classList.toggle('active', a.getAttribute('href') === `#${id}`);
            });
        }

        let indicatorEl = null;
        let indicatorClickLock = 0;   // 点击去抖动：距上次点击小于此毫秒数则忽略
        const INDICATOR_CLICK_MS = 320;
        const INDICATOR_SCROLL_MS = 420; // 点击时动画时长（300-500ms 范围内）

        // 从 section 提取标签文本（优先读 aria-labelledby 指向的元素，其次回退到 id 英文转可读文本）
        function getSectionLabel(sec) {
            const labelId = sec.getAttribute('aria-labelledby');
            if (labelId) {
                const el = document.getElementById(labelId);
                if (el && el.textContent) return el.textContent.trim();
            }
            // 回退：id 转可读名称
            const raw = (sec.id || 'section').replace(/[-_]/g, ' ');
            return raw.charAt(0).toUpperCase() + raw.slice(1);
        }

        function buildIndicator() {
            indicatorEl = document.createElement('div');
            indicatorEl.className = 'snap-indicator';
            indicatorEl.setAttribute('role', 'navigation');
            indicatorEl.setAttribute('aria-label', 'Resume section navigation');

            sections.forEach((sec, i) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'snap-indicator-dot' + (i === currentIndex ? ' is-active' : '');
                btn.setAttribute('data-index', String(i));
                btn.setAttribute('aria-label', '跳转到 ' + getSectionLabel(sec));
                btn.tabIndex = 0;

                // 左侧标签
                const label = document.createElement('span');
                label.className = 'snap-indicator-label';
                label.textContent = getSectionLabel(sec);
                btn.appendChild(label);

                // 点击：平滑跳转到对应栏目
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    // 去抖动：420ms 内不响应重复点击
                    const now = Date.now();
                    if (now - indicatorClickLock < INDICATOR_CLICK_MS) return;
                    indicatorClickLock = now;

                    snapTo(i, { type: 'switch', durationMs: INDICATOR_SCROLL_MS });
                });

                // 键盘可访问：Enter / Space 同点击
                btn.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        btn.click();
                    }
                });

                indicatorEl.appendChild(btn);
            });
            document.body.appendChild(indicatorEl);
        }

        function updateIndicator() {
            if (!indicatorEl) return;
            const dots = indicatorEl.querySelectorAll('.snap-indicator-dot');
            dots.forEach((d, i) => d.classList.toggle('is-active', i === currentIndex));
        }

        function destroyIndicator() {
            if (indicatorEl) {
                indicatorEl.remove();
                indicatorEl = null;
            }
        }

        // ------ 9) 判定 & 执行吸附（用户停止输入后触发） ------
        // 关键优化：在内部滚动容器（skills / experience）中，
        // 若用户未到达边界则只处理内部滚动，不触发外层栏目吸附。
        // 只在：(a) 到达内部容器边界后继续滚动，或 (b) 光标不在内部容器上时，
        // 才触发外层栏目吸附。

        // 用于判断 wheel 事件发生于哪个栏目 / 是否在内部滚动容器中
        const sectionScrollSelector = '.section-scroll';

        function resolveWheelTarget(e) {
            // 返回 { container: 最近的 section-scroll | null, sectionIndex: 当前栏目索引 }
            let node = e.target;
            let inner = null;
            while (node && node !== document.body) {
                if (node.classList && node.classList.contains('section-scroll')) {
                    inner = node;
                    break;
                }
                node = node.parentNode;
            }
            return { inner };
        }

        function decideAndSnap() {
            if (isSnapping) return;

            const currentY = window.scrollY;
            const maxY = getMaxScrollY();

            // 边界硬保护
            if (currentY <= 0) {
                snapTo(0, { type: 'rebound' });
                return;
            }
            if (currentY >= maxY - 1) {
                snapTo(sections.length - 1, { type: 'switch' });
                return;
            }

            // 找到距离最近的栏目
            // 先找到当前 scrollY 所在栏目（最后一个 sectionTop <= currentY）
            let idx = 0;
            for (let i = 0; i < sectionTops.length; i++) {
                if (currentY + 1 >= sectionTops[i]) idx = i;
                else break;
            }

            const currentTop = sectionTops[idx];
            const nextTop = idx + 1 < sectionTops.length ? sectionTops[idx + 1] : currentTop;

            // 相对当前栏目顶部的偏移量（正值=向下，负值=向上偏）
            const offset = currentY - currentTop;

            // 阈值：基于视口高度的比例
            const threshold = Math.round(window.innerHeight * activeCfg.switchThreshold);

            // 对于有内部滚动容器的栏目，使用更宽松的判定：
            // 只有当 scrollY 真正越过相邻栏目边界时才切换，
            // 避免用户只是在滚动内部内容时页面发生跳跃。
            const sec = sections[idx];
            const hasInnerScroll = !!sec.querySelector(sectionScrollSelector);

            if (hasInnerScroll) {
                // 宽松模式：使用相邻栏目的中点作为切换线，
                // 未到中点则回弹到当前栏目顶部（保证栏目对齐）
                const mid = (currentTop + nextTop) / 2;
                if (currentY < mid) {
                    // 还没到中点 → 吸附回当前栏目
                    if (Math.abs(offset) > 2) snapTo(idx, { type: 'rebound' });
                } else {
                    // 越过中点 → 切换到下一栏目
                    snapTo(Math.min(idx + 1, sections.length - 1), { type: 'switch' });
                }
            } else {
                // 普通栏目：标准阈值判断
                if (offset <= threshold && (nextTop - currentY) > threshold) {
                    snapTo(idx, { type: 'rebound' });
                } else {
                    const mid = (currentTop + nextTop) / 2;
                    const targetIdx = currentY >= mid ? Math.min(idx + 1, sections.length - 1) : idx;
                    snapTo(targetIdx, { type: 'switch' });
                }
            }
        }

        // ------ 10) 事件处理：wheel（鼠标滚轮 + 触控板） ------
        // 核心策略：
        //  - 若鼠标位于 section-scroll 内部 → 让浏览器自然滚内部；
        //    到达内部容器边界后，阻止事件继续向外层"穿透"，并触发外层栏目吸附。
        //  - 若鼠标不在内部滚动容器上 → 走原有吸附判断路径。
        function onWheel(e) {
            if (!isMobileSnapEnabled) return;

            // 动画期间直接阻止，避免用户输入与动画叠加
            if (isSnapping) {
                e.preventDefault();
                return;
            }

            // 检查是否在内部滚动容器中
            const { inner } = resolveWheelTarget(e);
            if (inner) {
                const atTop = inner.scrollTop <= 0;
                const atBottom = inner.scrollTop + inner.clientHeight >= inner.scrollHeight - 1;
                const goingUp = e.deltaY < 0;
                const goingDown = e.deltaY > 0;

                // —— 到达边界后的处理：触发外层吸附到相邻栏目 ——
                if ((atTop && goingUp) || (atBottom && goingDown)) {
                    e.preventDefault();
                    if (settleTimer) clearTimeout(settleTimer);
                    // 到达上边界 → 吸附到当前栏目顶部；
                    // 到达下边界 → 直接吸附到下一栏目顶部
                    const targetIdx = atTop ? currentIndex : Math.min(currentIndex + 1, sections.length - 1);
                    // 连续到达边界的节流，避免快速滚轮时重复
                    const nowT = performance.now();
                    if (nowT - lastInputTime > 120) {
                        snapTo(targetIdx, { type: 'switch' });
                    }
                    lastInputTime = nowT;
                    return;
                }

                // —— 未到边界：不阻止、不触发外层吸附 ——
                // 记录滚动以更新 active nav（节流）
                lastInputTime = performance.now();
                lastInputDelta = e.deltaY;
                if (settleTimer) clearTimeout(settleTimer);
                settleTimer = setTimeout(updateActiveFromScroll, activeCfg.settleMs);
                return;
            }

            // —— 不在内部滚动容器：原有吸附判断 ——
            lastInputTime = performance.now();
            lastInputDelta = e.deltaY;

            if (settleTimer) clearTimeout(settleTimer);
            settleTimer = setTimeout(decideAndSnap, activeCfg.settleMs);
        }

        // 同步更新导航高亮（仅在栏目可见区域改变时触发，不做吸附）
        function updateActiveFromScroll() {
            const y = window.scrollY + 1;
            let idx = 0;
            for (let i = 0; i < sectionTops.length; i++) {
                if (y >= sectionTops[i]) idx = i;
                else break;
            }
            if (idx !== currentIndex) {
                currentIndex = idx;
                updateActiveNav();
                updateIndicator();
            }
        }

        // ------ 11) 事件处理：触控（移动端，此时 isMobileSnapEnabled=false → 不生效） ------
        function onTouchStart(e) {
            if (!isMobileSnapEnabled) return;
            touchStartY = e.touches[0].clientY;
            touchLastY = touchStartY;
            touchStartTime = performance.now();
            if (settleTimer) clearTimeout(settleTimer);
            // 动画中不打断动画；但用户主动交互时取消动画
            if (isSnapping && rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
                isSnapping = false;
                document.documentElement.classList.remove('is-snapping');
            }
        }

        function onTouchMove(e) {
            if (!isMobileSnapEnabled) return;
            if (isSnapping) {
                e.preventDefault();
                return;
            }
            lastInputTime = performance.now();
        }

        function onTouchEnd() {
            if (!isMobileSnapEnabled) return;
            if (settleTimer) clearTimeout(settleTimer);
            settleTimer = setTimeout(() => decideAndSnap(), activeCfg.settleMs);
        }

        // ------ 12) 键盘：PageUp/Down，方向键（可选增强） ------
        // 在有内部滚动容器的栏目中，先滚动内部；到达边界后切换栏目。
        function onKeyDown(e) {
            if (!isMobileSnapEnabled) return;
            const key = e.key;

            // 仅处理特定按键
            if (!['PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', ' ', 'Home', 'End'].includes(key)) return;

            // 检查当前栏目是否有内部滚动容器
            const currentSec = sections[currentIndex];
            const inner = currentSec ? currentSec.querySelector(sectionScrollSelector) : null;

            if (inner) {
                const isGoingDown = key === 'PageDown' || key === ' ' || key === 'ArrowDown';
                const isGoingUp = key === 'PageUp' || key === 'ArrowUp';
                const atBottom = inner.scrollTop + inner.clientHeight >= inner.scrollHeight - 2;
                const atTop = inner.scrollTop <= 0;

                if (isGoingDown && !atBottom) {
                    // 向下滚动内部
                    e.preventDefault();
                    inner.scrollBy({ top: Math.round(inner.clientHeight * 0.8), behavior: 'smooth' });
                    return;
                }
                if (isGoingUp && !atTop) {
                    e.preventDefault();
                    inner.scrollBy({ top: -Math.round(inner.clientHeight * 0.8), behavior: 'smooth' });
                    return;
                }
                // 到达边界 → 继续执行外层吸附
            }

            // 外层吸附
            e.preventDefault();
            if (key === 'PageDown' || key === ' ' || key === 'ArrowDown') {
                snapTo(currentIndex + 1, { type: 'switch' });
            } else if (key === 'PageUp' || key === 'ArrowUp') {
                snapTo(currentIndex - 1, { type: 'switch' });
            } else if (key === 'Home') {
                snapTo(0, { type: 'switch' });
            } else if (key === 'End') {
                snapTo(sections.length - 1, { type: 'switch' });
            }
        }

        // ------ 13) 响应式：根据视口切换配置 ------
        function applyResponsive() {
            const w = window.innerWidth;
            if (w >= 1024) {
                activeCfg = CONFIG.desktop;
                isMobileSnapEnabled = true;
            } else if (w >= 768) {
                activeCfg = CONFIG.tablet;
                isMobileSnapEnabled = true;
            } else {
                activeCfg = CONFIG.mobile;
                isMobileSnapEnabled = false; // 移动端禁用磁吸，保留普通滚动
            }

            // 重新计算栏目位置
            sections = $$(sectionSelectors);
            computeSectionTops();

            // 根据当前 scrollY 修正 currentIndex
            const y = window.scrollY;
            let idx = 0;
            for (let i = 0; i < sectionTops.length; i++) {
                if (y + 1 >= sectionTops[i]) idx = i;
                else break;
            }
            currentIndex = idx;

            // 指示器只在桌面/平板显示
            if (isMobileSnapEnabled) {
                if (!indicatorEl) buildIndicator();
                else {
                    destroyIndicator();
                    buildIndicator();
                }
            } else {
                destroyIndicator();
            }

            updateActiveNav();
            updateIndicator();
        }

        // ------ 14) 对外 API：供 initSmoothScroll 调用 ------
        window.__snapController = {
            scrollToId(id) {
                const target = document.getElementById(id);
                if (!target) return;
                const idx = sections.indexOf(target);
                if (idx >= 0) {
                    snapTo(idx, { type: 'switch' });
                } else {
                    // 不在栏目列表中（如锚点跳转到 section 内部）：回退为平滑滚动
                    const top = target.getBoundingClientRect().top + window.scrollY;
                    animateScrollTo(top, activeCfg.snapDuration);
                }
            },
            refresh() {
                computeSectionTops();
            }
        };

        // ------ 15) 事件绑定 ------
        // wheel: 必须 non-passive 才能 preventDefault
        window.addEventListener('wheel', onWheel, { passive: false });
        window.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onTouchEnd, { passive: true });
        window.addEventListener('keydown', onKeyDown, { passive: false });

        // 窗口尺寸变化：重新计算栏目位置
        let resizeTimer = null;
        window.addEventListener('resize', () => {
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(applyResponsive, 200);
        });

        // 页面可见性变化：从后台回到前台时重新计算（避免缓存位置）
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) computeSectionTops();
        });

        // ------ 16) 初始化 ------
        // 给 hero 等元素一点时间完成布局
        applyResponsive();
        // 加载完成后再算一次（图片/字体可能改变布局）
        window.addEventListener('load', () => {
            computeSectionTops();
            // 如果初始不是从顶部加载，按当前 scrollY 判定 currentIndex
            const y = window.scrollY;
            let idx = 0;
            for (let i = 0; i < sectionTops.length; i++) {
                if (y + 1 >= sectionTops[i]) idx = i;
                else break;
            }
            currentIndex = idx;
            updateActiveNav();
            updateIndicator();
        });

        // 控制台调试输出（开发环境可开启）
        // console.log('[SnapController] 栏目数量:', sections.length, '配置:', activeCfg);
    }

    /* ---------- 平滑滚动（带导航偏移，兼容磁吸控制器） ---------- */
    function initSmoothScroll() {
        $$('a[href^="#"]').forEach(link => {
            link.addEventListener('click', (e) => {
                const targetId = link.getAttribute('href');
                if (!targetId || targetId === '#') return;

                const target = document.querySelector(targetId);
                if (!target) return;

                e.preventDefault();

                // 优先使用磁吸控制器：它会提供与滚动体验一致的动画
                if (window.__snapController) {
                    window.__snapController.scrollToId(targetId.slice(1));
                } else {
                    // 兜底：普通平滑滚动
                    const navbarHeight = ($('.navbar')?.offsetHeight || 0) + 10;
                    const top = target.getBoundingClientRect().top + window.scrollY - navbarHeight;

                    window.scrollTo({
                        top: Math.max(top, 0),
                        behavior: 'smooth'
                    });
                }

                // 更新 URL（不触发滚动）
                if (history.pushState) {
                    history.pushState(null, '', targetId);
                }
            });
        });
    }

    /* ---------- 滚动显现动画 (IntersectionObserver) ---------- */
    function initScrollReveal() {
        const revealTargets = $$(
            '.section-header, .about-card, .skill-card, .timeline-item, .edu-card, .cert-card, .contact-card, .skill-radar, .self-wrapper, .hero-text > *, .hero-visual'
        );

        revealTargets.forEach(el => el.classList.add('reveal'));

        if (!('IntersectionObserver' in window)) {
            revealTargets.forEach(el => el.classList.add('visible'));
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry, idx) => {
                if (entry.isIntersecting) {
                    // 同一容器内元素做错峰显现
                    setTimeout(() => entry.target.classList.add('visible'), idx * 60);
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.12,
            rootMargin: '0px 0px -60px 0px'
        });

        revealTargets.forEach(el => observer.observe(el));
    }

    /* ---------- 能力雷达图（五边形 SVG 动态渲染） ---------- */
    function initRadar() {
        const radar = $('#skillRadar');
        if (!radar) return;

        const svg = radar.querySelector('.radar-svg');
        if (!svg) return;

        // 维度数据（5 个维度，值为 0-100）
        const dimensions = [
            { label: '数据分析', short: 'BI', value: 95 },
            { label: 'SQL/Python', short: '代码', value: 90 },
            { label: 'AI 工具', short: 'Agent', value: 85 },
            { label: '项目管理', short: 'PM', value: 88 },
            { label: 'AIGC', short: 'AIGC', value: 80 }
        ];

        const N = dimensions.length;
        const CX = 210, CY = 210;      // viewBox 中心
        const R = 150;                // 最大半径
        const LAYERS = 4;              // 网格层数
        const LABEL_OFFSET = 28;       // 标签距离顶点的偏移

        // 计算某个顶点坐标，angleStart 让顶点朝上（-90°）
        const angle = (i) => (-Math.PI / 2) + (i * 2 * Math.PI / N);
        const point = (i, radius) => {
            const a = angle(i);
            return [CX + radius * Math.cos(a), CY + radius * Math.sin(a)];
        };
        const toPath = (pts) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ') + ' Z';

        // --- 网格多边形（4 层虚线五边形） ---
        const gridGroup = svg.querySelector('.radar-grid');
        let gridHTML = '';
        for (let layer = LAYERS; layer >= 1; layer--) {
            const r = (R * layer) / LAYERS;
            const pts = Array.from({ length: N }, (_, i) => point(i, r));
            gridHTML += `<polygon points="${pts.map(p => p.join(',')).join(' ')}" />`;
        }
        gridGroup.innerHTML = gridHTML;

        // --- 轴线（从中心到每个顶点） ---
        const axesGroup = svg.querySelector('.radar-axes');
        let axesHTML = '';
        for (let i = 0; i < N; i++) {
            const [x, y] = point(i, R);
            axesHTML += `<line x1="${CX}" y1="${CY}" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" />`;
        }
        axesGroup.innerHTML = axesHTML;

        // --- 数据多边形（按 value 缩放） ---
        const dataGroup = svg.querySelector('.radar-data');
        const dataPts = dimensions.map((d, i) => point(i, R * d.value / 100));
        dataGroup.innerHTML = `<polygon points="${dataPts.map(p => p.join(',')).join(' ')}" />`;

        // --- 数据点 ---
        const pointsGroup = svg.querySelector('.radar-points');
        let pointsHTML = '';
        dataPts.forEach((p, i) => {
            pointsHTML += `<circle cx="${p[0].toFixed(2)}" cy="${p[1].toFixed(2)}" style="animation-delay:${0.9 + i * 0.1}s" />`;
        });
        pointsGroup.innerHTML = pointsHTML;

        // --- 维度标签 + 百分比 ---
        const labelsGroup = svg.querySelector('.radar-labels');
        let labelsHTML = '';
        dimensions.forEach((d, i) => {
            const [x, y] = point(i, R + LABEL_OFFSET);
            labelsHTML += `<text class="dim-label" x="${x.toFixed(2)}" y="${y.toFixed(2) - 8}">${d.label}</text>`;
            labelsHTML += `<text class="value-label" x="${x.toFixed(2)}" y="${y.toFixed(2) + 12}">${d.value}%</text>`;
        });
        labelsGroup.innerHTML = labelsHTML;
    }

    /* ---------- 返回顶部 ---------- */
    function initBackToTop() {
        const btn = $('#backToTop');
        if (!btn) return;

        const onScroll = throttle(() => {
            if (window.scrollY > 400) {
                btn.classList.add('visible');
            } else {
                btn.classList.remove('visible');
            }
        }, 100);

        window.addEventListener('scroll', onScroll, { passive: true });

        btn.addEventListener('click', () => {
            if (window.__snapController) {
                window.__snapController.scrollToId('home');
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    /* ---------- 导航高亮当前区域 ---------- */
    function initActiveNavLink() {
        const sections = $$('main .section, header.hero');
        const navLinks = $$('.nav-link');
        if (!sections.length || !navLinks.length) return;

        if (!('IntersectionObserver' in window)) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.id;
                    navLinks.forEach(link => {
                        link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
                    });
                }
            });
        }, {
            threshold: 0.35,
            rootMargin: '-20% 0px -50% 0px'
        });

        sections.forEach(s => observer.observe(s));
    }

})();
