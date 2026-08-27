"use strict";

/* =========================================================
   NABINA UNIVERSE
   Main JavaScript
   - Persistent music across pages (SPA navigation)
   - Autoplay attempt + first-interaction fallback
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    initGlobal();
    initPage();
});

function initGlobal() {

    /* =====================================================
       MOBILE MENU
    ===================================================== */

    const menuToggle = document.getElementById("menuToggle");
    const mobileMenu = document.getElementById("mobileMenu");

    if (menuToggle && mobileMenu && !menuToggle.dataset.bound) {
        menuToggle.dataset.bound = "true";

        menuToggle.addEventListener("click", () => {
            const isOpen = mobileMenu.classList.toggle("is-open");

            menuToggle.classList.toggle("is-open", isOpen);
            menuToggle.setAttribute("aria-expanded", String(isOpen));
            document.body.classList.toggle("menu-open", isOpen);
        });

        mobileMenu.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", () => closeMobileMenu());
        });
    }

    /* =====================================================
       PERSISTENT MUSIC
       The audio element stays in the document while pages
       are changed with fetch + History API.
    ===================================================== */

    const musicToggle = document.getElementById("musicToggle");
    const ambience = document.getElementById("ambience");

    if (musicToggle && ambience && !musicToggle.dataset.bound) {
        musicToggle.dataset.bound = "true";

        musicToggle.addEventListener("click", async () => {
            try {
                if (ambience.paused) {
                    await ambience.play();
                    setMusicButtonState(true);
                } else {
                    ambience.pause();
                    setMusicButtonState(false);
                }
            } catch (error) {
                console.warn("Audio tidak dapat diputar:", error);
            }
        });

        ambience.addEventListener("play", () => setMusicButtonState(true));
        ambience.addEventListener("pause", () => setMusicButtonState(false));
    }

    /* =====================================================
       AUTOPLAY
       Browser may block unmuted autoplay. If blocked, the
       first click/tap/key interaction starts the music.
    ===================================================== */

    tryStartMusic();

    const startAfterInteraction = () => {
        tryStartMusic();
    };

    document.addEventListener("pointerdown", startAfterInteraction, {
        once: true,
        passive: true
    });

    document.addEventListener("keydown", startAfterInteraction, {
        once: true
    });

    /* =====================================================
       SPA PAGE NAVIGATION
       Keeps the SAME audio element alive so music never
       restarts when moving between Home/About/Gallery/Notes/
       Surprise.
    ===================================================== */

    document.addEventListener("click", handlePageLinkClick);

    window.addEventListener("popstate", () => {
        loadPage(window.location.href, false);
    });
}

async function handlePageLinkClick(event) {
    const link = event.target.closest("a[href]");

    if (!link) return;

    const href = link.getAttribute("href");

    if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:") ||
        link.target === "_blank" ||
        link.hasAttribute("download")
    ) {
        return;
    }

    /* Intercept same-origin page navigation so the existing audio
       element is NOT destroyed/recreated. */
    const url = new URL(href, window.location.href);

    if (url.origin !== window.location.origin) return;

    /* Let normal hash links stay normal. */
    if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) {
        return;
    }

    event.preventDefault();

    closeMobileMenu();
    await loadPage(url.href, true);
}

async function loadPage(url, pushHistory) {
    const transition = document.querySelector(".page-transition");

    try {
        if (transition) {
            transition.style.pointerEvents = "auto";
            transition.style.visibility = "visible";
            transition.style.opacity = "1";
        }

        const response = await fetch(url, {
            headers: {
                "X-Requested-With": "XMLHttpRequest"
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();
        const parser = new DOMParser();
        const nextDocument = parser.parseFromString(html, "text/html");

        const nextMain = nextDocument.querySelector("main");
        const currentMain = document.querySelector("main");

        if (!nextMain || !currentMain) {
            window.location.href = url;
            return;
        }

        /* Keep the current <audio> element untouched. */
        currentMain.replaceWith(nextMain);

        document.title = nextDocument.title;

        /* Update body class, e.g. surprise-page. */
        document.body.className = nextDocument.body.className;

        updateActiveNavigation(url);

        if (pushHistory) {
            window.history.pushState({}, "", url);
        }

        window.scrollTo({
            top: 0,
            behavior: "instant"
        });

        initPage();

        /* Give the transition a moment to finish. */
        requestAnimationFrame(() => {
            if (transition) {
                transition.style.opacity = "0";

                setTimeout(() => {
                    transition.style.visibility = "hidden";
                    transition.style.pointerEvents = "none";
                }, 250);
            }
        });

    } catch (error) {
        console.warn("SPA navigation gagal, pindah halaman biasa:", error);

        window.location.href = url;
    }
}

function updateActiveNavigation(url) {
    const targetUrl = new URL(url, window.location.href);
    let targetPath = targetUrl.pathname.split("/").pop();

    if (!targetPath) {
        targetPath = "index.html";
    }

    document.querySelectorAll("a.nav-link, a.mobile-link").forEach((link) => {
        const href = link.getAttribute("href");

        if (!href) return;

        const linkUrl = new URL(href, window.location.href);
        let linkPath = linkUrl.pathname.split("/").pop();

        if (!linkPath) {
            linkPath = "index.html";
        }

        const isActive = linkPath === targetPath;

        link.classList.toggle("active", isActive);

        if (isActive) {
            link.setAttribute("aria-current", "page");
        } else {
            link.removeAttribute("aria-current");
        }
    });
}

function closeMobileMenu() {
    const menuToggle = document.getElementById("menuToggle");
    const mobileMenu = document.getElementById("mobileMenu");

    if (mobileMenu) mobileMenu.classList.remove("is-open");
    if (menuToggle) {
        menuToggle.classList.remove("is-open");
        menuToggle.setAttribute("aria-expanded", "false");
    }

    document.body.classList.remove("menu-open");
}

function tryStartMusic() {
    const ambience = document.getElementById("ambience");

    if (!ambience || !ambience.paused) {
        if (ambience && !ambience.paused) {
            setMusicButtonState(true);
        }
        return;
    }

    ambience.play()
        .then(() => {
            setMusicButtonState(true);
        })
        .catch(() => {
            /* Expected when browser autoplay policy blocks audio. */
        });
}

function setMusicButtonState(isPlaying) {
    const musicToggle = document.getElementById("musicToggle");

    if (!musicToggle) return;

    musicToggle.classList.toggle("is-playing", isPlaying);

    musicToggle.setAttribute(
        "aria-pressed",
        String(isPlaying)
    );

    musicToggle.setAttribute(
        "aria-label",
        isPlaying ? "Matikan ambience" : "Putar ambience"
    );
}

function initPage() {

    /* =====================================================
       CURRENT YEAR
    ===================================================== */

    const yearElement = document.getElementById("currentYear");

    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }

    /* =====================================================
       REVEAL ON SCROLL
    ===================================================== */

    const revealElements =
        document.querySelectorAll(".reveal:not([data-reveal-bound])");

    if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver(
            (entries, observerInstance) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;

                    entry.target.classList.add("is-visible");
                    observerInstance.unobserve(entry.target);
                });
            },
            {
                threshold: 0.12,
                rootMargin: "0px 0px -40px 0px"
            }
        );

        revealElements.forEach((element) => {
            element.dataset.revealBound = "true";
            observer.observe(element);
        });
    } else {
        revealElements.forEach((element) => {
            element.dataset.revealBound = "true";
            element.classList.add("is-visible");
        });
    }

    /* =====================================================
       SURPRISE LETTER
       Opens as a floating letter over a blurred background.
       The body is revealed with a typewriter effect.
    ===================================================== */

    const surpriseButton = document.getElementById("surpriseButton");
    const letterOverlay = document.getElementById("letterOverlay");
    const letterClose = document.getElementById("letterClose");
    const letterBody = document.getElementById("letterBody");

    const letterText =
        "Hai, kamu.\n\n" +
        "Kalau kamu sampai membuka surat ini, mungkin ada satu hal yang ingin aku titipkan: terima kasih sudah hadir, disaat aku ngira aku ga bakal jatuh cinta lagi. Dari sekian banyak hal yang bisa terjadi, rasanya tetap indah mengetahui ada seseorang yang membuat hari-hari terasa sedikit lebih hangat hanya dengan menjadi dirinya sendiri.\n\n" +
        "Aku nggak tahu bagaimana perjalananmu nanti. Mungkin akan ada hari yang ringan, mungkin juga ada hari yang terasa panjang. Tapi kalau suatu saat kamu mulai meragukan dirimu sendiri, semoga kamu ingat bahwa kamu layak disayangi, didengar, dan dipilih—bukan karena kamu harus menjadi sempurna, tapi karena kamu adalah kamu. Dan kalau boleh jujur, ada sesuatu yang sederhana tapi spesial tentang senyummu. Sesuatu yang membuat hal kecil terasa berarti. Jadi, jangan terlalu keras pada dirimu sendiri, ya. Simpan sedikit ruang untuk bahagia, untuk bermimpi, dan untuk percaya bahwa hal-hal baik masih bisa datang.\n\n" +
        "Semoga kapan pun kamu membaca ini, kamu merasa sedikit lebih tenang. Dan semoga ada seseorang yang selalu mengingatkanmu: kamu berharga, kamu dicintai, dan kamu pantas mendapatkan cerita yang indah.";

    let typingTimer = null;
    let typingToken = 0;

    function openLetter() {
        if (!letterOverlay || !letterBody) return;

        typingToken += 1;
        const token = typingToken;

        clearInterval(typingTimer);
        letterBody.textContent = "";
        letterBody.classList.remove("is-done");

        letterOverlay.classList.add("is-visible");
        letterOverlay.setAttribute("aria-hidden", "false");
        document.body.classList.add("letter-open");

        requestAnimationFrame(() => {
            if (letterClose) letterClose.focus();
        });

        let index = 0;
        typingTimer = setInterval(() => {
            if (token !== typingToken) {
                clearInterval(typingTimer);
                return;
            }

            letterBody.textContent += letterText[index];
            index += 1;

            if (index >= letterText.length) {
                clearInterval(typingTimer);
                letterBody.classList.add("is-done");
            }
        }, 24);
    }

    function closeLetter() {
        if (!letterOverlay) return;

        typingToken += 1;
        clearInterval(typingTimer);

        letterOverlay.classList.remove("is-visible");
        letterOverlay.setAttribute("aria-hidden", "true");
        document.body.classList.remove("letter-open");

        if (surpriseButton) surpriseButton.focus();
    }

    if (surpriseButton && !surpriseButton.dataset.bound) {
        surpriseButton.dataset.bound = "true";
        surpriseButton.addEventListener("click", openLetter);
    }

    if (letterClose && !letterClose.dataset.bound) {
        letterClose.dataset.bound = "true";
        letterClose.addEventListener("click", closeLetter);
    }

    if (letterOverlay && !letterOverlay.dataset.bound) {
        letterOverlay.dataset.bound = "true";

        letterOverlay.addEventListener("click", (event) => {
            if (event.target.hasAttribute("data-letter-close")) {
                closeLetter();
            }
        });
    }

    /* =====================================================
       ESC KEY
    ===================================================== */

    if (!document.body.dataset.escapeBound) {
        document.body.dataset.escapeBound = "true";

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                closeMobileMenu();

                const overlay = document.getElementById("letterOverlay");
                if (overlay && overlay.classList.contains("is-visible")) {
                    closeLetter();
                }
            }
        });
    }

    /* Keep music button UI correct after page replacement. */
    const ambience = document.getElementById("ambience");
    if (ambience) {
        setMusicButtonState(!ambience.paused);
    }
}
