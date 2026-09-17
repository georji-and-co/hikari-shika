(() => {
  "use strict";

  const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

  /**
   * 休診日は YYYY-MM-DD で追加する。
   * holidays: 祝日 / extraClosures: 臨時休診
   */
  const CLINIC_CALENDAR = {
    holidays: [
      "2026-01-01",
      "2026-01-12",
      "2026-02-11",
      "2026-02-23",
      "2026-03-20",
      "2026-04-29",
      "2026-05-03",
      "2026-05-04",
      "2026-05-05",
      "2026-05-06",
      "2026-07-20",
      "2026-08-11",
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-10-12",
      "2026-11-03",
      "2026-11-23",
      "2027-01-01",
      "2027-01-11",
      "2027-02-11",
      "2027-02-23",
      "2027-03-21",
      "2027-04-29",
      "2027-05-03",
      "2027-05-04",
      "2027-05-05",
      "2027-07-19",
      "2027-08-11",
      "2027-09-20",
      "2027-09-23",
      "2027-10-11",
      "2027-11-03",
      "2027-11-23",
    ],
    extraClosures: [
      // 例: "2026-12-30"
    ],
    extraOpenings: [
      // 例: { date: "2026-12-29", slots: [{ start: "10:30", end: "12:30" }] }
    ],
  };

  const WEEKDAY_SLOTS = {
    1: [
      { start: "10:30", end: "12:30", label: "午前診療" },
      { start: "15:00", end: "20:00", label: "午後診療" },
    ],
    3: [
      { start: "10:30", end: "12:30", label: "午前診療" },
      { start: "15:00", end: "20:00", label: "午後診療" },
    ],
    5: [
      { start: "10:30", end: "12:30", label: "午前診療" },
      { start: "15:00", end: "20:00", label: "午後診療" },
    ],
  };

  const SATURDAY_SLOTS = [
    { start: "10:00", end: "12:00", label: "午前診療" },
    { start: "14:00", end: "17:00", label: "午後診療" },
  ];

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function partsInJst(date = new Date()) {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    });
    const map = {};
    for (const part of fmt.formatToParts(date)) {
      if (part.type !== "literal") map[part.type] = part.value;
    }
    const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return {
      ymd: `${map.year}-${map.month}-${map.day}`,
      year: Number(map.year),
      month: Number(map.month),
      day: Number(map.day),
      hour: Number(map.hour),
      minute: Number(map.minute),
      weekday: weekdayMap[map.weekday],
    };
  }

  function toMinutes(hm) {
    const [h, m] = hm.split(":").map(Number);
    return h * 60 + m;
  }

  function formatMinutes(min) {
    return `${Math.floor(min / 60)}:${pad(min % 60)}`;
  }

  function saturdayOrdinal(dayOfMonth) {
    return Math.ceil(dayOfMonth / 7);
  }

  function isNthSaturdayOpen(dayOfMonth) {
    const n = saturdayOrdinal(dayOfMonth);
    return n === 1 || n === 3 || n === 5;
  }

  function slotsForDate(p) {
    const extraOpen = CLINIC_CALENDAR.extraOpenings.find((item) => item.date === p.ymd);
    if (extraOpen) return extraOpen.slots;

    if (CLINIC_CALENDAR.extraClosures.includes(p.ymd)) return [];
    if (CLINIC_CALENDAR.holidays.includes(p.ymd)) return [];

    if (p.weekday === 6) {
      return isNthSaturdayOpen(p.day) ? SATURDAY_SLOTS : [];
    }

    return WEEKDAY_SLOTS[p.weekday] || [];
  }

  function nextOpenFrom(startDate) {
    for (let i = 0; i < 21; i += 1) {
      const probe = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const p = partsInJst(probe);
      const slots = slotsForDate(p);
      if (!slots.length) continue;
      if (i === 0) {
        const nowMin = p.hour * 60 + p.minute;
        const later = slots.find((s) => nowMin < toMinutes(s.start));
        if (later) {
          return `${later.start} から${later.label}`;
        }
        continue;
      }
      const first = slots[0];
      const when = i === 1 ? "明日" : `${p.month}/${p.day}（${DAY_NAMES[p.weekday]}）`;
      return `${when} ${first.start} から`;
    }
    return "次回診療日はお電話でご確認ください";
  }

  function getClinicStatus(now = new Date()) {
    const p = partsInJst(now);
    const nowMin = p.hour * 60 + p.minute;
    const slots = slotsForDate(p);
    const holiday = CLINIC_CALENDAR.holidays.includes(p.ymd);
    const extraClosed = CLINIC_CALENDAR.extraClosures.includes(p.ymd);

    if (extraClosed) {
      return {
        kind: "closed",
        label: "休診中",
        detail: `本日は臨時休診です。次回は${nextOpenFrom(now)}`,
      };
    }

    if (holiday) {
      return {
        kind: "closed",
        label: "休診中",
        detail: `本日は祝日のため休診です。次回は${nextOpenFrom(now)}`,
      };
    }

    if (!slots.length) {
      let reason = `本日（${DAY_NAMES[p.weekday]}）は休診日です`;
      if (p.weekday === 6) reason = "本日は第2・4土曜日のため休診です";
      if (p.weekday === 2) reason = "本日は火曜のため休診です";
      if (p.weekday === 4) reason = "本日は木曜のため休診です";
      if (p.weekday === 0) reason = "本日は日曜のため休診です";
      return {
        kind: "closed",
        label: "休診中",
        detail: `${reason}。次回は${nextOpenFrom(now)}`,
      };
    }

    for (const slot of slots) {
      const start = toMinutes(slot.start);
      const end = toMinutes(slot.end);
      if (nowMin >= start && nowMin < end) {
        return {
          kind: "open",
          label: "診療中",
          detail: `現在${slot.label}（${formatMinutes(end)}まで）`,
        };
      }
    }

    if (slots.length >= 2) {
      const morningEnd = toMinutes(slots[0].end);
      const afternoonStart = toMinutes(slots[1].start);
      if (nowMin >= morningEnd && nowMin < afternoonStart) {
        return {
          kind: "closed",
          label: "休診中",
          detail: `${slots[1].start}より再開`,
        };
      }
    }

    const upcoming = slots.find((s) => nowMin < toMinutes(s.start));
    if (upcoming) {
      return {
        kind: "closed",
        label: "診療時間外",
        detail: `次の診療は${upcoming.start}から（${upcoming.label}）`,
      };
    }

    return {
      kind: "closed",
      label: "本日の診療終了",
      detail: `次回は${nextOpenFrom(now)}`,
    };
  }

  function renderStatus() {
    const bar = document.getElementById("status-bar");
    const label = document.getElementById("status-label");
    const detail = document.getElementById("status-detail");
    if (!bar || !label || !detail) return;

    const status = getClinicStatus();
    bar.classList.remove("is-open", "is-closed", "is-break");
    bar.classList.add(`is-${status.kind}`);
    label.textContent = status.label;
    detail.textContent = status.detail;
  }

  function setupNav() {
    const toggle = document.getElementById("nav-toggle");
    const panel = document.getElementById("nav-panel");
    if (!toggle || !panel) return;

    const close = () => {
      toggle.classList.remove("is-open");
      panel.classList.remove("is-open");
      document.body.classList.remove("is-nav-open");
      toggle.setAttribute("aria-expanded", "false");
    };

    toggle.addEventListener("click", () => {
      const open = !panel.classList.contains("is-open");
      toggle.classList.toggle("is-open", open);
      panel.classList.toggle("is-open", open);
      document.body.classList.toggle("is-nav-open", open);
      toggle.setAttribute("aria-expanded", String(open));
    });

    panel.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", close);
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
  }

  function setupReveal() {
    const nodes = document.querySelectorAll(".reveal");
    if (!nodes.length) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      nodes.forEach((el) => el.classList.add("is-in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    nodes.forEach((el) => io.observe(el));
  }

  function setupCompare() {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    document.querySelectorAll("[data-compare]").forEach((el) => {
      const set = (ratio, rest) => {
        el.style.setProperty("--split", `${Math.round(ratio * 1000) / 10}%`);
        el.classList.toggle("is-resting", Boolean(rest) && !reduced);
      };

      set(0.5, false);

      const fromEvent = (event) => {
        const rect = el.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        set(Math.min(1, Math.max(0, x)), false);
      };

      let dragging = false;

      el.addEventListener("pointerdown", (event) => {
        dragging = true;
        el.setPointerCapture(event.pointerId);
        fromEvent(event);
      });

      el.addEventListener("pointermove", (event) => {
        if (event.pointerType === "mouse" || dragging) fromEvent(event);
      });

      const release = () => {
        dragging = false;
        set(0.5, true);
      };

      el.addEventListener("pointerup", release);
      el.addEventListener("pointercancel", release);
      el.addEventListener("pointerleave", () => {
        if (!dragging) set(0.5, true);
      });
    });
  }

  function setupParallax() {
    const el = document.querySelector("[data-parallax]");
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let ticking = false;
    const update = () => {
      const y = Math.min(window.scrollY, 480);
      el.style.transform = `translate3d(0, ${y * 0.07}px, 0)`;
      ticking = false;
    };

    window.addEventListener(
      "scroll",
      () => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(update);
      },
      { passive: true }
    );
  }

  renderStatus();
  setInterval(renderStatus, 60 * 1000);
  setupNav();
  setupReveal();
  setupCompare();
  setupParallax();
})();
