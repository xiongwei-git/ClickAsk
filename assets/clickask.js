/**
 * ClickAsk alpha - bookmarklet page context picker.
 */
(function () {
  "use strict";

  const NS = "ca";
  const ROOT = "ca-root";
  const ID_ATTR = "data-clickask-id";
  const MAX_ELEMENTS = 20;
  const MAX_TEXT = 500;
  const MAX_HTML = 600;
  const MAX_PROMPT = 8000;
  const locale = detectLocale();

  if (document.querySelector("." + ROOT)) return;

  let idCounter = 0;
  let hoverBox = null;
  let panel = null;
  let selectedElements = [];
  let dragState = null;
  let justDragged = false;
  let rafPending = false;
  let lastMoveTarget = null;
  let paused = false;
  let minimized = false;
  let copyTimer = null;
  const listeners = [];
  const overlays = new Map();
  // CR-009: CSP fallback state
  let cspBanner = null;
  let cspDegraded = false;
  const cspViolations = new Set();
  // CR-007: screenshot state
  const screenshots = new Map(); // key: ID_ATTR value -> { dataURL, width, height }
  let html2canvasState = "idle"; // idle | loading | ready | failed
  let html2canvasPromise = null;
  let html2canvasScript = null;

  // CR-010: i18n strings split per language for clearer maintenance.
  const STRINGS_EN = {
      selecting: "Ready",
      paused: "Paused",
      minimize: "Minimize",
      restore: "Restore",
      close: "Close",
      fieldLabel: "What do you want to ask?",
      placeholder: "Example: Help me distribute these three sections evenly horizontally.",
      promptTypeLabel: "Prompt type",
      autoLabel: "Auto detect",
      recommendedPrefix: "Recommended",
      manualPrefix: "Manual",
      copy: "Copy Prompt",
      copied: "Copied",
      remove: "Remove",
      aiLaunchLabel: "Open in AI tool",
      aiLaunchHint: "Copies the prompt and opens a new tab",
      previewLabel: "Prompt preview",
      previewEmpty: "Select element(s) to see the generated prompt here.",
      historyLabel: "Recent prompts",
      historyEmpty: "Copied prompts will appear here.",
      historyRestore: "Restore this prompt",
      cspWarning: "This page restricts inline styles via CSP. ClickAsk runs in fallback mode \u2014 some visuals may look basic.",
      cspDismiss: "Got it",
      snapAction: "Snap",
      snapTitle: "Capture screenshot of this element",
      snapLoading: "Loading screenshot library\u2026",
      snapCapturing: "Capturing\u2026",
      snapFailed: "Screenshot failed",
      snapCrossOrigin: "This region contains cross-origin assets and cannot be captured.",
      snapBlocked: "Screenshot library blocked by page CSP.",
      snapDownload: "Download",
      snapRemove: "Remove screenshot",
      snapSection: "Screenshots",
      shortcuts: "Click select · Shift multi · Drag select · Alt pass-through · Esc clear · Cmd/Ctrl+C copy",
      noRequest: "[No explicit request provided]",
      promptTruncated: "[Prompt truncated]",
      pageHeading: "Page",
      url: "URL",
      title: "Title",
      path: "Path",
      viewport: "Viewport",
      generated: "Generated",
      requestHeading: "User Original Request",
      selectedHeading: "Selected Content",
      pleaseDo: "Please Do",
      fields: {
        selector: "selector",
        xpath: "xpath",
        shadowPath: "shadowPath",
        roleName: "role/name",
        react: "react",
        source: "source",
        data: "data",
        text: "text",
        html: "html"
      },
      templates: {
        general: {
          label: "General question",
          title: "Page Context Question",
          tip: "Answer the user's question based on the selected page context.",
          instructions: [
            "Understand the user's original request and answer using the selected page context.",
            "If the request is ambiguous, state your interpretation before answering.",
            "If the page context is insufficient, say exactly what is missing."
          ]
        },
        summarize: {
          label: "Summarize",
          title: "Page Content Summary",
          tip: "Distill the selected content into short, fact-preserving bullets.",
          instructions: [
            "Summarize the selected content clearly and concisely.",
            "Use short bullet points.",
            "Preserve key numbers, conclusions, names, and terms."
          ]
        },
        analyze: {
          label: "Analyze cause",
          title: "Page Context Analysis",
          tip: "Reason about anomalies / trends / causes ranked by confidence.",
          instructions: [
            "Analyze possible issues, anomalies, trends, or causes in the selected content.",
            "Rank likely explanations by confidence when possible.",
            "List the extra information needed to confirm the conclusion."
          ]
        },
        debug: {
          label: "Debug issue",
          title: "Page Issue Debugging",
          tip: "Diagnose the visible problem and suggest concrete next steps.",
          instructions: [
            "Identify what problem is shown in the selected content.",
            "Explain likely causes.",
            "Provide concrete troubleshooting steps.",
            "If this is a technical error, explain the error meaning in practical terms."
          ]
        },
        ux: {
          label: "Improve UI/UX",
          title: "UI/UX Improvement Request",
          tip: "Critique readability / hierarchy / copy and propose fixes.",
          instructions: [
            "Review readability, hierarchy, layout, copy, and interaction issues in the selected area.",
            "Give specific improvement suggestions.",
            "When useful, provide revised copy or layout guidance."
          ]
        },
        code: {
          label: "Code change",
          title: "Code Change Request",
          tip: "Map the element to source code and propose source-level edits.",
          instructions: [
            "Infer the likely frontend implementation from the selected element context.",
            "Use source, react, selector, XPath, and data attributes to help locate the code.",
            "Give clear source-level modification guidance.",
            "Do not only suggest editing browser DOM; explain what should change in the source code."
          ]
        }
      }
  };
  const STRINGS_ZH = {
      selecting: "就绪",
      paused: "已暂停",
      minimize: "最小化",
      restore: "恢复",
      close: "关闭",
      fieldLabel: "你想问什么？",
      placeholder: "例如：帮我把这三个空间横向均等分布",
      promptTypeLabel: "Prompt 类型",
      autoLabel: "自动判断",
      recommendedPrefix: "推荐",
      manualPrefix: "手动",
      copy: "复制 Prompt",
      copied: "已复制",
      remove: "移除",
      aiLaunchLabel: "在 AI 中打开",
      aiLaunchHint: "会复制 prompt 并打开新标签页",
      previewLabel: "Prompt 预览",
      previewEmpty: "选中元素后，这里会显示完整 prompt。",
      historyLabel: "最近的需求",
      historyEmpty: "复制过的 prompt 会出现在这里。",
      historyRestore: "填回这条需求",
      cspWarning: "本页面的 CSP 限制了样式注入，ClickAsk 已进入降级模式，部分视觉效果可能比较粗糙。",
      cspDismiss: "知道了",
      snapAction: "截图",
      snapTitle: "为该元素生成截图",
      snapLoading: "正在加载截图库…",
      snapCapturing: "截图中…",
      snapFailed: "截图失败",
      snapCrossOrigin: "该区域含跨域资源，无法截图。",
      snapBlocked: "页面 CSP 拦截了截图库加载。",
      snapDownload: "下载",
      snapRemove: "移除截图",
      snapSection: "截图",
      shortcuts: "点击选择 · Shift 多选 · 拖拽框选 · Alt 穿透 · Esc 清空 · Cmd/Ctrl+C 复制",
      noRequest: "[用户未填写明确问题]",
      promptTruncated: "[Prompt 已截断]",
      pageHeading: "页面信息",
      url: "URL",
      title: "标题",
      path: "路径",
      viewport: "Viewport",
      generated: "生成时间",
      requestHeading: "用户原始需求",
      selectedHeading: "选中内容",
      pleaseDo: "请完成",
      fields: {
        selector: "selector",
        xpath: "xpath",
        shadowPath: "shadowPath",
        roleName: "role/name",
        react: "react",
        source: "source",
        data: "data",
        text: "text",
        html: "html"
      },
      templates: {
        general: {
          label: "通用提问",
          title: "页面上下文提问",
          tip: "结合选中页面上下文，回答用户原始问题。",
          instructions: [
            "理解用户原始需求，并结合选中的页面上下文回答。",
            "如果用户描述不清楚，请先说明你的理解，再给出回答。",
            "如果页面上下文不足，请明确指出还缺少什么信息。"
          ]
        },
        summarize: {
          label: "总结内容",
          title: "页面内容总结",
          tip: "用短条目提炼选中内容，保留关键数字与结论。",
          instructions: [
            "清晰、简洁地总结选中内容。",
            "使用短条目输出。",
            "保留关键数字、结论、名称和专有名词。"
          ]
        },
        analyze: {
          label: "分析原因",
          title: "页面上下文分析",
          tip: "分析异常 / 趋势 / 可能原因，按可信度排序。",
          instructions: [
            "分析选中内容中可能存在的问题、异常、趋势或原因。",
            "如果可能，请按可信度排序给出解释。",
            "列出还需要哪些额外信息才能确认结论。"
          ]
        },
        debug: {
          label: "排查问题",
          title: "页面问题排查",
          tip: "诊断页面上可见的问题并给出可执行排查步骤。",
          instructions: [
            "判断选中内容展示的问题是什么。",
            "解释可能原因。",
            "给出具体可执行的排查步骤。",
            "如果这是技术错误，请用实用语言解释错误含义。"
          ]
        },
        ux: {
          label: "UI/体验改进",
          title: "UI/体验改进请求",
          tip: "评估可读性 / 层级 / 文案问题并给出改进建议。",
          instructions: [
            "评估选中区域的可读性、信息层级、布局、文案和交互问题。",
            "给出具体改进建议。",
            "如果适合，请提供改写后的文案或布局建议。"
          ]
        },
        code: {
          label: "代码修改建议",
          title: "代码修改请求",
          tip: "将选中元素映射到源码并给出源码级修改建议。",
          instructions: [
            "根据选中元素上下文推断它可能对应的前端实现。",
            "优先使用 source、react、selector、XPath 和 data 属性定位代码。",
            "给出清晰的源码级修改建议。",
            "不要只建议修改浏览器 DOM，应说明需要修改源码中的什么。"
          ]
        }
      }
  };
  const translations = { en: STRINGS_EN, zh: STRINGS_ZH };
  const t = translations[locale];
  t.lang = locale;
  const promptTemplates = t.templates;
  const AI_TOOLS = [
    { id: "chatgpt", label: "ChatGPT", url: "https://chat.openai.com/" },
    { id: "claude", label: "Claude", url: "https://claude.ai/new" },
    { id: "gemini", label: "Gemini", url: "https://gemini.google.com/app" },
    { id: "kimi", label: "Kimi", url: "https://www.kimi.com/" },
    { id: "doubao", label: "豆包", url: "https://www.doubao.com/" }
  ];
  const HISTORY_KEY = "clickask:prompt-history";
  const HISTORY_LIMIT = 5;
  const HISTORY_INTENT_MAX = 200;
  // CR-010: keywords bucketed per language. Same-locale matches use the
  // declared weight; cross-locale matches are added at half weight (rounded
  // up) so bilingual users still get sensible recommendations.
  const intentRules = {
    summarize: {
      weight: 3,
      keywords: {
        zh: ["总结", "概括", "归纳", "提炼", "摘要", "讲一下", "说一下"],
        en: ["summary", "summarize", "summarise", "recap", "tl;dr", "brief"]
      }
    },
    debug: {
      weight: 4,
      keywords: {
        zh: ["错误", "报错", "异常", "失败", "崩溃", "解决", "修复", "不对", "不能用", "跑不起来", "怎么回事"],
        en: ["bug", "debug", "fix", "error", "exception", "failed", "failure", "broken", "crash", "issue"]
      }
    },
    analyze: {
      weight: 3,
      keywords: {
        zh: ["为什么", "原因", "分析", "趋势", "下降", "增长", "上涨", "下跌", "异常", "变化", "影响", "对比"],
        en: ["why", "analyze", "analyse", "cause", "reason", "trend", "drop", "growth", "increase", "decrease", "compare", "insight"]
      }
    },
    ux: {
      weight: 3,
      keywords: {
        zh: ["优化", "好看", "难看", "改进", "体验", "布局", "文案", "交互", "设计", "高级", "清晰", "易用"],
        en: ["ui", "ux", "design", "layout", "copy", "polish", "improve", "better", "usable"]
      }
    },
    code: {
      weight: 3,
      keywords: {
        zh: ["代码", "组件", "样式", "源码", "实现", "函数", "接口", "修改代码", "改代码"],
        en: ["css", "react", "vue", "component", "source", "implementation", "refactor", "frontend"]
      }
    }
  };

  function init() {
    createHoverBox();
    createPanel();

    on(document, "mousedown", handleMouseDown, true);
    on(document, "mousemove", handleMouseMove, true);
    on(document, "mouseup", handleMouseUp, true);
    on(document, "click", handleClick, true);
    on(document, "dragstart", handleDragStart, true);
    on(document, "keydown", handleKeyDown, true);
    // Listen on <html> without capture so this only fires when the mouse
    // truly leaves the viewport, not when it transitions between child
    // elements (which would kill the marquee mid-drag).
    on(document.documentElement, "mouseleave", function () {
      showHover(null);
      cancelDrag();
    }, false);

    let repositionPending = false;
    const scheduleReposition = function () {
      if (repositionPending) return;
      repositionPending = true;
      requestAnimationFrame(function () {
        positionAllOverlays();
        repositionPending = false;
      });
    };
    on(window, "scroll", scheduleReposition, true);
    on(window, "resize", scheduleReposition, false);

    // CR-009: CSP fallback wiring
    on(document, "securitypolicyviolation", handleCspViolation, false);
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(verifyStylesApplied);
    } else {
      setTimeout(verifyStylesApplied, 0);
    }
  }

  function destroy() {
    listeners.forEach(function (entry) {
      entry.target.removeEventListener(entry.type, entry.fn, entry.capture);
    });
    destroyAllOverlays();
    if (hoverBox) hoverBox.remove();
    if (panel) panel.remove();
    // CR-009: clear CSP fallback banner
    if (cspBanner) { cspBanner.remove(); cspBanner = null; }
    cspDegraded = false;
    cspViolations.clear();
    // CR-007: clear screenshots state. Vendor script tag stays cached on purpose for fast re-init.
    screenshots.clear();
    cancelDrag();
    Array.from(document.querySelectorAll("[" + ID_ATTR + "]")).forEach(function (el) {
      el.removeAttribute(ID_ATTR);
    });
    // CR-008: also clean ids inside shadow trees
    walkAllElements(document.body, function (el) {
      if (el.hasAttribute && el.hasAttribute(ID_ATTR)) el.removeAttribute(ID_ATTR);
    });
  }

  function on(target, type, fn, capture) {
    target.addEventListener(type, fn, capture);
    listeners.push({ target: target, type: type, fn: fn, capture: capture });
  }

  function ensureId(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return null;
    let id = el.getAttribute(ID_ATTR);
    if (!id) {
      id = "ca-" + idCounter++;
      el.setAttribute(ID_ATTR, id);
    }
    return id;
  }

  // CR-008: Shadow DOM helpers ------------------------------------------------
  function getEventTarget(event) {
    if (event && typeof event.composedPath === "function") {
      const path = event.composedPath();
      if (path && path.length) {
        for (let i = 0; i < path.length; i++) {
          const node = path[i];
          if (node && node.nodeType === Node.ELEMENT_NODE) return node;
        }
      }
    }
    return event ? event.target : null;
  }

  function parentAcrossShadow(node) {
    if (!node) return null;
    if (node.parentElement) return node.parentElement;
    const root = node.getRootNode && node.getRootNode();
    if (root && typeof ShadowRoot !== "undefined" && root instanceof ShadowRoot) {
      return root.host || null;
    }
    return null;
  }

  function getShadowHostChain(el) {
    const chain = [];
    let cur = el;
    while (cur) {
      const root = cur.getRootNode && cur.getRootNode();
      if (root && typeof ShadowRoot !== "undefined" && root instanceof ShadowRoot && root.host) {
        chain.unshift(root.host);
        cur = root.host;
      } else {
        break;
      }
    }
    return chain;
  }

  function walkAllElements(root, callback) {
    if (!root) return;
    const stack = [root];
    while (stack.length) {
      const node = stack.pop();
      if (node.nodeType === Node.ELEMENT_NODE) {
        callback(node);
        if (node.shadowRoot) stack.push(node.shadowRoot);
      }
      const kids = node.children;
      if (kids && kids.length) {
        for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
      }
    }
  }
  // ---------------------------------------------------------------------------

  // CR-009: CSP fallback ------------------------------------------------------
  function handleCspViolation(event) {
    if (!event) return;
    cspViolations.add(event.violatedDirective || event.effectiveDirective || "unknown");
    const dir = (event.violatedDirective || "").toString();
    if (dir.indexOf("style") === 0 || dir.indexOf("script") === 0) {
      enterDegradedMode();
    }
  }

  function verifyStylesApplied() {
    if (!panel || cspDegraded) return;
    try {
      const computed = (typeof getComputedStyle === "function") ? getComputedStyle(panel) : null;
      if (!computed) return;
      if (computed.position && computed.position !== "fixed" && computed.position !== "") {
        enterDegradedMode();
      }
    } catch (e) { /* getComputedStyle can throw inside detached docs */ }
  }

  function enterDegradedMode() {
    if (cspDegraded) return;
    cspDegraded = true;
    applyInlineFallback();
    showCspBanner();
  }

  function applyInlineFallback() {
    if (panel) {
      panel.style.cssText = [
        "position:fixed", "top:16px", "right:16px", "width:340px",
        "max-height:80vh", "overflow:auto", "background:#ffffff", "color:#111827",
        "border:1px solid #e5e7eb", "border-radius:8px", "padding:12px",
        "font:13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
        "box-shadow:0 4px 16px rgba(0,0,0,0.18)", "z-index:2147483647"
      ].join(";");
    }
    if (hoverBox) {
      hoverBox.style.cssText = [
        "position:fixed", "pointer-events:none", "border:2px solid #4f46e5",
        "background:rgba(79,70,229,0.1)", "z-index:2147483646",
        "opacity:0", "transition:opacity 0.1s"
      ].join(";");
    }
  }

  function showCspBanner() {
    if (cspBanner || typeof document === "undefined") return;
    cspBanner = document.createElement("div");
    cspBanner.className = NS + "-csp-banner " + ROOT;
    cspBanner.setAttribute("role", "status");
    cspBanner.setAttribute("aria-live", "polite");
    cspBanner.style.cssText = [
      "position:fixed", "left:12px", "bottom:12px", "max-width:340px",
      "background:#fef2f2", "color:#991b1b", "border:1px solid #fecaca",
      "border-radius:6px", "padding:8px 12px", "z-index:2147483647",
      "font:12px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "box-shadow:0 2px 8px rgba(0,0,0,0.12)"
    ].join(";");
    const text = document.createElement("span");
    text.textContent = t.cspWarning;
    text.style.cssText = "display:block;margin-bottom:6px";
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.textContent = t.cspDismiss;
    dismiss.style.cssText = "background:transparent;color:#991b1b;border:1px solid #fecaca;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:11px";
    dismiss.addEventListener("click", function () {
      if (cspBanner) { cspBanner.remove(); cspBanner = null; }
    });
    cspBanner.appendChild(text);
    cspBanner.appendChild(dismiss);
    document.body.appendChild(cspBanner);
  }
  // ---------------------------------------------------------------------------

  // CR-007: screenshot via html2canvas (self-hosted, lazy loaded) -------------
  function html2canvasUrl() {
    // bookmarklet entry script lives at <origin>/assets/clickask.js -> sibling vendor file
    try {
      const scripts = document.getElementsByTagName("script");
      for (let i = scripts.length - 1; i >= 0; i--) {
        const src = scripts[i].src || "";
        const m = src.match(/^(.*\/)assets\/clickask\.js(\?.*)?$/);
        if (m) return m[1] + "assets/vendor/html2canvas.min.js";
      }
    } catch (e) { /* ignore */ }
    return "/assets/vendor/html2canvas.min.js";
  }

  function loadHtml2Canvas() {
    if (typeof window !== "undefined" && window.html2canvas) {
      html2canvasState = "ready";
      return Promise.resolve(window.html2canvas);
    }
    if (html2canvasState === "ready" && html2canvasPromise) return html2canvasPromise;
    if (html2canvasState === "loading" && html2canvasPromise) return html2canvasPromise;
    if (html2canvasState === "failed") return Promise.reject(new Error("html2canvas failed"));
    html2canvasState = "loading";
    html2canvasPromise = new Promise(function (resolve, reject) {
      const script = document.createElement("script");
      html2canvasScript = script;
      script.src = html2canvasUrl();
      script.async = true;
      script.onload = function () {
        if (window.html2canvas) {
          html2canvasState = "ready";
          resolve(window.html2canvas);
        } else {
          html2canvasState = "failed";
          reject(new Error("html2canvas missing after load"));
        }
      };
      script.onerror = function () {
        html2canvasState = "failed";
        reject(new Error("html2canvas script load error"));
      };
      document.head.appendChild(script);
    });
    return html2canvasPromise;
  }

  function captureElement(el) {
    return loadHtml2Canvas().then(function (h2c) {
      return h2c(el, { backgroundColor: null, useCORS: true, scale: 1, logging: false });
    }).then(function (canvas) {
      let dataURL;
      try {
        dataURL = canvas.toDataURL("image/png");
      } catch (e) {
        const err = new Error("cross-origin");
        err.code = "cross-origin";
        throw err;
      }
      return { dataURL: dataURL, width: canvas.width, height: canvas.height };
    });
  }
  // ---------------------------------------------------------------------------

  function isToolElement(el) {
    return !!(el && el.closest && el.closest("." + ROOT));
  }

  function createHoverBox() {
    hoverBox = document.createElement("div");
    hoverBox.className = NS + "-hover-box";
    document.body.appendChild(hoverBox);
  }

  function createPanel() {
    panel = document.createElement("div");
    panel.className = ROOT + " " + NS + "-panel";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "ClickAsk");
    panel.innerHTML = [
      '<div class="' + NS + '-panel-head">',
      '  <button type="button" class="' + NS + '-status" data-ca-action="toggle-pause" aria-pressed="false"><span class="' + NS + '-status-dot"></span><span class="' + NS + '-brand">ClickAsk</span><span class="' + NS + '-status-label" aria-live="polite">' + escapeHtml(t.selecting) + '</span></button>',
      '  <div class="' + NS + '-panel-actions">',
      '    <button class="' + NS + '-icon-btn" data-ca-action="minimize" title="' + escapeHtml(t.minimize) + '" aria-label="' + escapeHtml(t.minimize) + '">-</button>',
      '    <button class="' + NS + '-icon-btn" data-ca-action="close" title="' + escapeHtml(t.close) + '" aria-label="' + escapeHtml(t.close) + '">x</button>',
      '  </div>',
      '</div>',
      '<div class="' + NS + '-panel-body">',
      '  <div class="' + NS + '-tags ' + NS + '-hidden"></div>',
      '  <div class="' + NS + '-shots ' + NS + '-hidden" aria-label="' + escapeHtml(t.snapSection) + '"></div>',
      '  <div class="' + NS + '-snap-status ' + NS + '-hidden" aria-live="polite"></div>',
      '  <label class="' + NS + '-field-label" for="ca-intent">' + escapeHtml(t.fieldLabel) + '</label>',
      '  <textarea id="ca-intent" class="' + NS + '-intent" rows="4" placeholder="' + escapeHtml(t.placeholder) + '"></textarea>',
      '  <div class="' + NS + '-row">',
      '    <select class="' + NS + '-type" aria-label="' + escapeHtml(t.promptTypeLabel) + '"></select>',
      '    <button class="' + NS + '-copy" disabled>' + escapeHtml(t.copy) + '</button>',
      '  </div>',
      '  <div class="' + NS + '-recommendation" aria-live="polite"></div>',
      '  <div class="' + NS + '-template-tip" aria-live="polite"></div>',
      '  <details class="' + NS + '-preview">',
      '    <summary class="' + NS + '-preview-summary">' + escapeHtml(t.previewLabel) + '</summary>',
      '    <pre class="' + NS + '-preview-body"></pre>',
      '  </details>',
      '  <div class="' + NS + '-history">',
      '    <div class="' + NS + '-history-label">' + escapeHtml(t.historyLabel) + '</div>',
      '    <div class="' + NS + '-history-row" role="list" aria-label="' + escapeHtml(t.historyLabel) + '"></div>',
      '  </div>',
      '  <div class="' + NS + '-launch">',
      '    <div class="' + NS + '-launch-label" title="' + escapeHtml(t.aiLaunchHint) + '">' + escapeHtml(t.aiLaunchLabel) + '</div>',
      '    <div class="' + NS + '-launch-row" role="group" aria-label="' + escapeHtml(t.aiLaunchLabel) + '"></div>',
      '  </div>',
      '  <div class="' + NS + '-shortcuts">' + escapeHtml(t.shortcuts) + '</div>',
      '</div>'
    ].join("");
    document.body.appendChild(panel);

    renderLaunchButtons();
    renderHistory();

    const type = panel.querySelector("." + NS + "-type");
    const autoOption = document.createElement("option");
    autoOption.value = "auto";
    autoOption.textContent = t.autoLabel;
    type.appendChild(autoOption);
    Object.keys(promptTemplates).forEach(function (key) {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = promptTemplates[key].label;
      if (promptTemplates[key].tip) option.title = promptTemplates[key].tip;
      type.appendChild(option);
    });

    panel.querySelector("." + NS + "-copy").addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      copyPrompt();
    });
    panel.querySelector('[data-ca-action="close"]').addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      destroy();
    });
    panel.querySelector('[data-ca-action="minimize"]').addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      toggleMinimized();
    });
    panel.querySelector('[data-ca-action="toggle-pause"]').addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      togglePaused();
    });
    panel.querySelector("." + NS + "-intent").addEventListener("input", updateRecommendation);
    type.addEventListener("change", updateRecommendation);
    makeDraggable(panel, panel.querySelector("." + NS + "-panel-head"));
    updatePanel();
  }

  function renderLaunchButtons() {
    const row = panel.querySelector("." + NS + "-launch-row");
    if (!row) return;
    row.innerHTML = "";
    AI_TOOLS.forEach(function (tool) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = NS + "-launch-btn";
      btn.setAttribute("data-ca-tool", tool.id);
      btn.textContent = tool.label;
      btn.disabled = true;
      btn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        launchAiTool(tool.id);
      });
      row.appendChild(btn);
    });
  }

  function launchAiTool(toolId) {
    const tool = AI_TOOLS.find(function (item) { return item.id === toolId; });
    if (!tool || selectedElements.length === 0) return;
    const prompt = buildPrompt();
    if (prompt) writeClipboard(prompt);
    recordHistoryFromCurrent();
    window.open(tool.url, "_blank", "noopener,noreferrer");
  }

  function recordHistoryFromCurrent() {
    if (!panel) return;
    const intentEl = panel.querySelector("." + NS + "-intent");
    if (!intentEl) return;
    const intent = intentEl.value.trim();
    if (!intent) return;
    const type = getEffectivePromptType();
    saveHistory(intent, type);
    renderHistory();
  }

  function loadHistory() {
    try {
      const raw = window.localStorage && window.localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (item) {
        return item && typeof item.intent === "string" && typeof item.type === "string";
      }).slice(0, HISTORY_LIMIT);
    } catch (e) {
      return [];
    }
  }

  function persistHistory(list) {
    try {
      if (!window.localStorage) return;
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    } catch (e) {
      // storage unavailable (private mode / cross-origin iframe) — silent no-op
    }
  }

  function saveHistory(intent, type) {
    if (!intent) return;
    const trimmed = intent.length > HISTORY_INTENT_MAX ? intent.slice(0, HISTORY_INTENT_MAX) : intent;
    const list = loadHistory().filter(function (item) {
      return !(item.intent === trimmed && item.type === type);
    });
    list.unshift({ intent: trimmed, type: type, at: Date.now() });
    if (list.length > HISTORY_LIMIT) list.length = HISTORY_LIMIT;
    persistHistory(list);
  }

  function clearHistoryAt(index) {
    const list = loadHistory();
    if (index < 0 || index >= list.length) return;
    list.splice(index, 1);
    persistHistory(list);
  }

  function restoreHistory(index) {
    const list = loadHistory();
    const item = list[index];
    if (!item || !panel) return;
    const intentEl = panel.querySelector("." + NS + "-intent");
    const typeEl = panel.querySelector("." + NS + "-type");
    if (intentEl) {
      intentEl.value = item.intent;
      intentEl.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (typeEl && promptTemplates[item.type]) {
      typeEl.value = item.type;
      typeEl.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function renderHistory() {
    if (!panel) return;
    const row = panel.querySelector("." + NS + "-history-row");
    if (!row) return;
    row.innerHTML = "";
    const list = loadHistory();
    if (list.length === 0) {
      const empty = document.createElement("div");
      empty.className = NS + "-history-empty";
      empty.textContent = t.historyEmpty;
      row.appendChild(empty);
      return;
    }
    list.forEach(function (item, index) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = NS + "-history-chip";
      chip.title = item.intent + " — " + ((promptTemplates[item.type] && promptTemplates[item.type].label) || item.type);
      chip.setAttribute("aria-label", t.historyRestore);

      const text = document.createElement("span");
      text.className = NS + "-history-chip-text";
      text.textContent = item.intent;
      chip.appendChild(text);

      const tag = document.createElement("span");
      tag.className = NS + "-history-chip-tag";
      tag.textContent = (promptTemplates[item.type] && promptTemplates[item.type].label) || item.type;
      chip.appendChild(tag);

      const del = document.createElement("span");
      del.className = NS + "-history-chip-del";
      del.setAttribute("role", "button");
      del.setAttribute("aria-label", t.remove);
      del.title = t.remove;
      del.textContent = "×";
      del.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        clearHistoryAt(index);
        renderHistory();
      });
      chip.appendChild(del);

      chip.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        restoreHistory(index);
      });

      row.appendChild(chip);
    });
  }

  function toggleMinimized() {
    minimized = !minimized;
    const body = panel.querySelector("." + NS + "-panel-body");
    const button = panel.querySelector('[data-ca-action="minimize"]');
    body.style.display = minimized ? "none" : "";
    button.textContent = minimized ? "+" : "-";
    button.title = minimized ? t.restore : t.minimize;
    button.setAttribute("aria-label", button.title);
    showHover(null);
  }

  function makeDraggable(box, handle) {
    let sx = 0;
    let sy = 0;
    let sl = 0;
    let st = 0;
    handle.addEventListener("mousedown", function (event) {
      if (event.target.closest("button")) return;
      event.preventDefault();
      const rect = box.getBoundingClientRect();
      sx = event.clientX;
      sy = event.clientY;
      sl = rect.left;
      st = rect.top;
      const move = function (moveEvent) {
        box.style.left = sl + moveEvent.clientX - sx + "px";
        box.style.top = st + moveEvent.clientY - sy + "px";
        box.style.right = "auto";
        box.style.bottom = "auto";
      };
      const up = function () {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });
  }

  function handleMouseMove(event) {
    if (paused || minimized) return;
    if (event.altKey) {
      showHover(null);
      return;
    }

    if (dragState) {
      const dx = event.clientX - dragState.startX;
      const dy = event.clientY - dragState.startY;
      if (!dragState.dragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
        dragState.dragging = true;
        dragState.marquee = document.createElement("div");
        dragState.marquee.className = NS + "-marquee";
        document.body.appendChild(dragState.marquee);
        showHover(null);
      }
      if (dragState.dragging) {
        dragState.marquee.style.left = Math.min(event.clientX, dragState.startX) + "px";
        dragState.marquee.style.top = Math.min(event.clientY, dragState.startY) + "px";
        dragState.marquee.style.width = Math.abs(dx) + "px";
        dragState.marquee.style.height = Math.abs(dy) + "px";
        return;
      }
    }

    lastMoveTarget = resolveTarget(getEventTarget(event));
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(function () {
        showHover(lastMoveTarget);
        rafPending = false;
      });
    }
  }

  function handleMouseDown(event) {
    const tgt = getEventTarget(event);
    if (isToolElement(tgt) || paused || minimized || event.button !== 0 || event.altKey) return;
    // Prevent the browser from kicking off native text selection or HTML5
    // drag-and-drop. Without this, hovering over an <img>/<a> mid-drag steals
    // future mousemove events and the marquee "loses" the cursor.
    event.preventDefault();
    dragState = {
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
      marquee: null
    };
  }

  function handleDragStart(event) {
    // Belt-and-braces: if a draggable element still tries to start a native
    // drag while we're marquee-selecting, suppress it.
    if (dragState) {
      event.preventDefault();
    }
  }

  function handleMouseUp(event) {
    if (!dragState || !dragState.dragging) {
      dragState = null;
      return;
    }
    const rect = dragState.marquee.getBoundingClientRect();
    dragState.marquee.remove();
    dragState = null;
    justDragged = true;
    if (!event.shiftKey) clearSelection();

    // Collect all candidate elements whose rects intersect the marquee.
    var candidates = [];
    Array.from(document.body.getElementsByTagName("*")).forEach(function (el) {
      if (candidates.length >= MAX_ELEMENTS) return;
      if (isToolElement(el) || !isVisible(el) || !isMeaningful(el)) return;
      if (rectsIntersect(rect, el.getBoundingClientRect())) candidates.push(el);
    });
    // CR-008: also reach into shadow trees during marquee
    walkAllElements(document.body, function (el) {
      if (candidates.length >= MAX_ELEMENTS) return;
      var root = el.getRootNode && el.getRootNode();
      if (!root || typeof ShadowRoot === "undefined" || !(root instanceof ShadowRoot)) return;
      if (isToolElement(el) || !isVisible(el) || !isMeaningful(el)) return;
      if (candidates.indexOf(el) >= 0) return;
      if (rectsIntersect(rect, el.getBoundingClientRect())) candidates.push(el);
    });

    // Prune ancestors: if an element is an ancestor of another candidate,
    // remove the ancestor so only the most-specific (leaf) elements remain.
    var pruned = candidates.filter(function (el) {
      return !candidates.some(function (other) {
        return other !== el && el.contains(other);
      });
    });

    pruned.forEach(function (el) {
      if (selectedElements.length >= MAX_ELEMENTS) return;
      addSelection(el);
    });
    updatePanel();
    setTimeout(function () {
      justDragged = false;
    }, 0);
  }

  function handleClick(event) {
    const tgt = getEventTarget(event);
    if (isToolElement(tgt) || paused || minimized || justDragged || event.altKey) return;
    event.preventDefault();
    event.stopPropagation();

    const selected = resolveTarget(tgt);
    if (!selected || isToolElement(selected)) return;
    if (event.shiftKey) {
      toggleSelection(selected);
    } else {
      clearSelection();
      addSelection(selected);
    }
    const textSelection = window.getSelection();
    if (textSelection) textSelection.removeAllRanges();
    updatePanel();
  }

  function handleKeyDown(event) {
    if (isTextInput(getEventTarget(event))) return;
    const mod = event.metaKey || event.ctrlKey;
    if (event.key === "Escape") {
      event.preventDefault();
      clearSelection();
      updatePanel();
      return;
    }
    if (event.key === " " && !mod && !event.altKey) {
      event.preventDefault();
      togglePaused();
      return;
    }
    if (mod && event.key.toLowerCase() === "c" && selectedElements.length > 0) {
      event.preventDefault();
      copyPrompt();
      return;
    }
    if (selectedElements.length === 1) {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        navigateParent();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        navigateChild();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigateSibling(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        navigateSibling(1);
      }
    }
  }

  function isTextInput(el) {
    if (!el || !el.tagName) return false;
    const tag = el.tagName.toLowerCase();
    return tag === "textarea" || tag === "input" || tag === "select" || el.isContentEditable;
  }

  function togglePaused() {
    paused = !paused;
    showHover(null);
    panel.querySelector("." + NS + "-status-label").textContent = paused ? t.paused : t.selecting;
    panel.querySelector("." + NS + "-status-dot").classList.toggle(NS + "-paused", paused);
    const statusBtn = panel.querySelector('[data-ca-action="toggle-pause"]');
    if (statusBtn) statusBtn.setAttribute("aria-pressed", paused ? "true" : "false");
  }

  function resolveTarget(el) {
    let cur = el;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      if (isToolElement(cur) || !isVisible(cur)) {
        cur = parentAcrossShadow(cur);
        continue;
      }
      if (isMeaningful(cur)) return cur;
      cur = parentAcrossShadow(cur);
    }
    return el && !isToolElement(el) ? el : null;
  }

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 && rect.height < 2) return false;
    const style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }

  function isMeaningful(el) {
    if (!el || !el.children) return false;
    if (hasDirectText(el)) return true;
    if (el.matches("img,video,canvas,svg,button,a,input,select,textarea,iframe,table,pre,code")) return true;
    if (el.querySelector("img,video,canvas,svg,button,a,input,select,textarea,iframe,table,pre,code")) return true;
    return el.children.length > 1;
  }

  function hasDirectText(el) {
    return Array.from(el.childNodes).some(function (node) {
      return node.nodeType === Node.TEXT_NODE && node.textContent.trim();
    });
  }

  function showHover(el) {
    if (!hoverBox) return;
    if (!el || isToolElement(el) || selectedElements.indexOf(el) >= 0) {
      hoverBox.style.opacity = "0";
      return;
    }
    const rect = el.getBoundingClientRect();
    hoverBox.style.left = rect.left - 1 + "px";
    hoverBox.style.top = rect.top - 1 + "px";
    hoverBox.style.width = rect.width + 2 + "px";
    hoverBox.style.height = rect.height + 2 + "px";
    hoverBox.style.opacity = "1";
  }

  function addSelection(el) {
    if (!el || selectedElements.indexOf(el) >= 0 || selectedElements.length >= MAX_ELEMENTS) return;
    ensureId(el);
    selectedElements.push(el);
    createOverlay(el);
  }

  function removeSelection(el) {
    const idx = selectedElements.indexOf(el);
    if (idx === -1) return;
    selectedElements.splice(idx, 1);
    destroyOverlay(el.getAttribute(ID_ATTR));
  }

  function toggleSelection(el) {
    if (selectedElements.indexOf(el) >= 0) removeSelection(el);
    else addSelection(el);
  }

  function clearSelection() {
    destroyAllOverlays();
    selectedElements = [];
    showHover(null);
  }

  function createOverlay(el) {
    const id = el.getAttribute(ID_ATTR);
    if (!id || overlays.has(id)) return;
    const box = document.createElement("div");
    box.className = NS + "-sel-box";
    const label = document.createElement("div");
    label.className = NS + "-sel-label";
    label.textContent = elementLabel(el);
    document.body.appendChild(box);
    document.body.appendChild(label);
    overlays.set(id, { box: box, label: label });
    positionOverlay(el);
  }

  function positionOverlay(el) {
    const id = el.getAttribute(ID_ATTR);
    const overlay = overlays.get(id);
    if (!overlay) return;
    if (!el.isConnected) {
      removeSelection(el);
      return;
    }
    const rect = el.getBoundingClientRect();
    const pad = 2;
    overlay.box.style.left = rect.left - pad + "px";
    overlay.box.style.top = rect.top - pad + "px";
    overlay.box.style.width = rect.width + pad * 2 + "px";
    overlay.box.style.height = rect.height + pad * 2 + "px";
    overlay.label.style.left = rect.left - pad + "px";
    overlay.label.style.top = Math.max(2, rect.top - 24) + "px";
  }

  function positionAllOverlays() {
    selectedElements.slice().forEach(positionOverlay);
  }

  function destroyOverlay(id) {
    const overlay = overlays.get(id);
    if (!overlay) return;
    overlay.box.remove();
    overlay.label.remove();
    overlays.delete(id);
  }

  function destroyAllOverlays() {
    Array.from(overlays.keys()).forEach(destroyOverlay);
  }

  function cancelDrag() {
    if (dragState && dragState.marquee) dragState.marquee.remove();
    dragState = null;
  }

  function rectsIntersect(a, b) {
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
  }

  function navigateParent() {
    const current = selectedElements[0];
    let parent = current.parentElement;
    while (parent && parent !== document.body && parent !== document.documentElement) {
      if (!isToolElement(parent) && isVisible(parent)) {
        clearSelection();
        addSelection(parent);
        updatePanel();
        return;
      }
      parent = parent.parentElement;
    }
  }

  function navigateChild() {
    const current = selectedElements[0];
    for (const child of current.children) {
      if (!isToolElement(child) && isVisible(child) && isMeaningful(child)) {
        clearSelection();
        addSelection(child);
        updatePanel();
        return;
      }
    }
  }

  function navigateSibling(dir) {
    const current = selectedElements[0];
    const parent = current.parentElement;
    if (!parent) return;
    const siblings = Array.from(parent.children).filter(function (el) {
      return !isToolElement(el) && isVisible(el) && isMeaningful(el);
    });
    const next = siblings[siblings.indexOf(current) + dir];
    if (next) {
      clearSelection();
      addSelection(next);
      updatePanel();
    }
  }

  function updatePanel() {
    const tags = panel.querySelector("." + NS + "-tags");
    const copy = panel.querySelector("." + NS + "-copy");
    tags.innerHTML = "";
    copy.disabled = selectedElements.length === 0;
    updateLaunchButtons();
    if (selectedElements.length === 0) {
      tags.classList.add(NS + "-hidden");
      updateRecommendation();
      return;
    }
    tags.classList.remove(NS + "-hidden");
    selectedElements.forEach(function (el, index) {
      const tag = document.createElement("span");
      tag.className = NS + "-tag";
      const text = document.createElement("span");
      text.textContent = index + 1 + ". " + elementLabel(el);
      // CR-007: snap button
      const snap = document.createElement("button");
      snap.type = "button";
      snap.className = NS + "-snap-btn";
      snap.title = t.snapTitle;
      snap.setAttribute("aria-label", t.snapTitle);
      snap.textContent = "\uD83D\uDCF7";
      snap.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        handleSnapClick(el, snap);
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.title = t.remove;
      remove.setAttribute("aria-label", t.remove);
      remove.textContent = "x";
      remove.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        removeSelection(el);
        updatePanel();
      });
      tag.appendChild(text);
      tag.appendChild(snap);
      tag.appendChild(remove);
      tags.appendChild(tag);
    });
    renderShots();
    updateRecommendation();
  }

  // CR-007: snap handlers ----------------------------------------------------
  function setSnapStatus(message) {
    if (!panel) return;
    const status = panel.querySelector("." + NS + "-snap-status");
    if (!status) return;
    if (!message) {
      status.textContent = "";
      status.classList.add(NS + "-hidden");
    } else {
      status.textContent = message;
      status.classList.remove(NS + "-hidden");
    }
  }

  function handleSnapClick(el, button) {
    const id = ensureId(el);
    if (button) button.disabled = true;
    setSnapStatus(html2canvasState === "ready" ? t.snapCapturing : t.snapLoading);
    captureElement(el).then(function (shot) {
      screenshots.set(id, { dataURL: shot.dataURL, width: shot.width, height: shot.height });
      setSnapStatus("");
      if (button) button.disabled = false;
      renderShots();
      refreshPreview();
    }).catch(function (err) {
      if (button) button.disabled = false;
      const code = err && err.code;
      if (code === "cross-origin") {
        setSnapStatus(t.snapCrossOrigin);
      } else if (cspViolations.size && Array.from(cspViolations).some(function (d) { return String(d).indexOf("script") === 0; })) {
        setSnapStatus(t.snapBlocked);
      } else {
        setSnapStatus(t.snapFailed + (err && err.message ? ": " + err.message : ""));
      }
    });
  }

  function renderShots() {
    if (!panel) return;
    const container = panel.querySelector("." + NS + "-shots");
    if (!container) return;
    container.innerHTML = "";
    if (!screenshots.size) {
      container.classList.add(NS + "-hidden");
      return;
    }
    container.classList.remove(NS + "-hidden");
    selectedElements.forEach(function (el, index) {
      const id = el.getAttribute(ID_ATTR);
      if (!id || !screenshots.has(id)) return;
      const shot = screenshots.get(id);
      const item = document.createElement("div");
      item.className = NS + "-shot";
      item.setAttribute("data-shot-id", id);
      const img = document.createElement("img");
      img.className = NS + "-thumb";
      img.src = shot.dataURL;
      img.alt = "#" + (index + 1) + " " + elementLabel(el);
      const actions = document.createElement("div");
      actions.className = NS + "-shot-actions";
      const dl = document.createElement("a");
      dl.className = NS + "-shot-download";
      dl.href = shot.dataURL;
      dl.download = "clickask-" + id + ".png";
      dl.textContent = t.snapDownload;
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = NS + "-shot-remove";
      rm.title = t.snapRemove;
      rm.setAttribute("aria-label", t.snapRemove);
      rm.textContent = "x";
      rm.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        screenshots.delete(id);
        renderShots();
        refreshPreview();
      });
      actions.appendChild(dl);
      actions.appendChild(rm);
      item.appendChild(img);
      item.appendChild(actions);
      container.appendChild(item);
    });
  }
  // ---------------------------------------------------------------------------

  function updateLaunchButtons() {
    if (!panel) return;
    const enabled = selectedElements.length > 0;
    panel.querySelectorAll("." + NS + "-launch-btn").forEach(function (btn) {
      btn.disabled = !enabled;
    });
  }

  function updateRecommendation() {
    if (!panel) return;
    const note = panel.querySelector("." + NS + "-recommendation");
    const type = panel.querySelector("." + NS + "-type");
    if (!note || !type) return;
    const effective = getEffectivePromptType();
    const label = promptTemplates[effective] ? promptTemplates[effective].label : promptTemplates.general.label;
    const prefix = type.value === "auto" ? t.recommendedPrefix : t.manualPrefix;
    note.textContent = prefix + ": " + label;
    const tipEl = panel.querySelector("." + NS + "-template-tip");
    if (tipEl) {
      const tip = (promptTemplates[effective] && promptTemplates[effective].tip) || "";
      tipEl.textContent = tip;
    }
    refreshPreview();
  }

  function refreshPreview() {
    if (!panel) return;
    const body = panel.querySelector("." + NS + "-preview-body");
    if (!body) return;
    if (selectedElements.length === 0) {
      body.textContent = t.previewEmpty;
      return;
    }
    body.textContent = buildPrompt();
  }

  function copyPrompt() {
    const prompt = buildPrompt();
    if (!prompt) return;
    writeClipboard(prompt);
    recordHistoryFromCurrent();
  }

  function writeClipboard(text) {
    // CR-007: try ClipboardItem multi-MIME write when screenshots exist.
    if (screenshots.size && typeof ClipboardItem !== "undefined" && navigator.clipboard && navigator.clipboard.write) {
      try {
        const firstShot = screenshots.values().next().value;
        const blob = dataUrlToBlob(firstShot.dataURL);
        if (blob) {
          const item = new ClipboardItem({
            "text/plain": new Blob([text], { type: "text/plain" }),
            "image/png": blob
          });
          navigator.clipboard.write([item]).then(showCopied, function () {
            // Fallback to text-only path on failure (Safari often rejects image MIME).
            writeClipboardText(text);
          });
          return;
        }
      } catch (_) { /* fallthrough */ }
    }
    writeClipboardText(text);
  }

  function writeClipboardText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(showCopied, function () {
        fallbackCopy(text);
        showCopied();
      });
    } else {
      fallbackCopy(text);
      showCopied();
    }
  }

  function dataUrlToBlob(dataURL) {
    try {
      const parts = dataURL.split(",");
      const meta = parts[0] || "";
      const isB64 = meta.indexOf(";base64") >= 0;
      const mime = (meta.match(/^data:([^;]+)/) || [])[1] || "image/png";
      const body = parts[1] || "";
      if (!isB64) return new Blob([decodeURIComponent(body)], { type: mime });
      const bin = atob(body);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return new Blob([u8], { type: mime });
    } catch (e) { return null; }
  }

  function fallbackCopy(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.cssText = "position:fixed;left:0;top:0;opacity:0;pointer-events:none";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand("copy");
    } catch (_) {}
    textarea.remove();
  }

  function showCopied() {
    const button = panel.querySelector("." + NS + "-copy");
    if (copyTimer) clearTimeout(copyTimer);
    button.textContent = t.copied;
    button.classList.add(NS + "-copied");
    copyTimer = setTimeout(function () {
      button.textContent = t.copy;
      button.classList.remove(NS + "-copied");
      copyTimer = null;
    }, 1400);
  }

  function buildPrompt() {
    if (selectedElements.length === 0) return "";
    const intent = panel.querySelector("." + NS + "-intent").value.trim();
    const type = getEffectivePromptType();
    const template = promptTemplates[type] || promptTemplates.general;
    const page = getPageContext();
    const lines = [
      "# " + template.title,
      "",
      "## " + t.pageHeading,
      "- " + t.url + ": " + page.url,
      "- " + t.title + ": " + page.title,
      "- " + t.path + ": " + page.path,
      "- " + t.viewport + ": " + page.viewport,
      "- " + t.generated + ": " + page.generatedAt,
      "",
      "## " + t.requestHeading,
      intent || t.noRequest,
      "",
      "## " + t.selectedHeading
    ];

    selectedElements.slice(0, MAX_ELEMENTS).forEach(function (el, index) {
      const ctx = buildElementContext(el, index + 1);
      lines.push("");
      lines.push("### " + ctx.index + ". " + ctx.label + " <" + ctx.tag + ">");
      lines.push("- " + t.fields.selector + ": `" + ctx.selector + "`");
      lines.push("- " + t.fields.xpath + ": `" + ctx.xpath + "`");
      if (ctx.shadowPath) lines.push("- " + t.fields.shadowPath + ": `" + ctx.shadowPath + "`");
      if (ctx.roleName) lines.push("- " + t.fields.roleName + ": " + ctx.roleName);
      if (ctx.react) lines.push("- " + t.fields.react + ": " + ctx.react);
      if (ctx.source) lines.push("- " + t.fields.source + ": " + ctx.source);
      if (Object.keys(ctx.dataAttrs).length) lines.push("- " + t.fields.data + ": " + JSON.stringify(ctx.dataAttrs));
      if (ctx.text) lines.push("- " + t.fields.text + ": " + block(ctx.text));
      if (ctx.html) lines.push("- " + t.fields.html + ": " + block(ctx.html));
      // CR-007: hint that a screenshot is attached for this element (clipboard image)
      const sid = el.getAttribute(ID_ATTR);
      if (sid && screenshots.has(sid)) {
        const shot = screenshots.get(sid);
        lines.push("- " + t.snapSection + ": [" + shot.width + "x" + shot.height + " PNG attached via clipboard image]");
      }
    });

    lines.push("");
    lines.push("## " + t.pleaseDo);
    template.instructions.forEach(function (instruction, index) {
      lines.push(index + 1 + ". " + instruction);
    });

    let result = lines.join("\n");
    if (result.length > MAX_PROMPT) {
      result = result.slice(0, MAX_PROMPT) + "\n\n" + t.promptTruncated;
    }
    return result;
  }

  function getEffectivePromptType() {
    const type = panel && panel.querySelector("." + NS + "-type");
    if (!type || type.value === "auto") return detectIntentType();
    return promptTemplates[type.value] ? type.value : "general";
  }

  function detectIntentType() {
    const input = panel ? panel.querySelector("." + NS + "-intent").value : "";
    const context = getIntentContext();
    const text = normalizeIntentText(input + " " + context.text);
    const scores = {
      general: 0,
      summarize: 0,
      debug: 0,
      analyze: 0,
      ux: 0,
      code: 0
    };

    Object.keys(intentRules).forEach(function (type) {
      const rule = intentRules[type];
      const primary = (rule.keywords && rule.keywords[locale]) || [];
      const secondary = (rule.keywords && rule.keywords[locale === "zh" ? "en" : "zh"]) || [];
      const halfWeight = Math.ceil(rule.weight / 2);
      primary.forEach(function (keyword) {
        if (text.indexOf(normalizeIntentText(keyword)) !== -1) {
          scores[type] += rule.weight;
        }
      });
      secondary.forEach(function (keyword) {
        if (text.indexOf(normalizeIntentText(keyword)) !== -1) {
          scores[type] += halfWeight;
        }
      });
    });

    if (/(typeerror|referenceerror|syntaxerror|exception|stack trace|cannot read|undefined|null|failed|error|\berr\b|报错|错误|异常|失败)/i.test(context.text)) {
      scores.debug += 4;
    }
    if (context.hasTable || /(\$|¥|￥|%|\d+[,.]?\d*\s*(%|万|亿|k|m|ms|s|px)|增长|下降|趋势|环比|同比)/i.test(context.text)) {
      scores.analyze += 2;
    }
    if (context.hasInteractive || /(button|input|select|textarea|nav|form|按钮|表单|导航|交互)/i.test(context.text)) {
      scores.ux += 1;
    }
    if (context.hasSource && /(改|修改|代码|样式|组件|实现|css|react|vue|component|source|code|change|fix)/i.test(text)) {
      scores.code += 3;
    }

    const priority = ["debug", "code", "analyze", "summarize", "ux", "general"];
    let best = "general";
    let bestScore = 0;
    priority.forEach(function (type) {
      if (scores[type] > bestScore) {
        best = type;
        bestScore = scores[type];
      }
    });
    return bestScore > 0 ? best : "general";
  }

  function getIntentContext() {
    const parts = [];
    let hasTable = false;
    let hasInteractive = false;
    let hasSource = false;
    selectedElements.forEach(function (el) {
      const tag = el.tagName ? el.tagName.toLowerCase() : "";
      if (tag === "table" || el.querySelector("table")) hasTable = true;
      if (/^(button|input|select|textarea|form|nav|a)$/.test(tag) || el.querySelector("button,input,select,textarea,form,nav,a")) {
        hasInteractive = true;
      }
      const react = getReactDebug(el);
      if (react.source || react.react) hasSource = true;
      parts.push(tag);
      parts.push(el.getAttribute("role") || "");
      parts.push(el.getAttribute("aria-label") || "");
      parts.push(el.getAttribute("title") || "");
      parts.push((el.innerText || el.textContent || "").slice(0, 1200));
    });
    return {
      text: parts.join(" "),
      hasTable: hasTable,
      hasInteractive: hasInteractive,
      hasSource: hasSource
    };
  }

  function normalizeIntentText(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function getPageContext() {
    return {
      url: location.href,
      path: location.pathname || "/",
      title: document.title || "[Untitled]",
      viewport: window.innerWidth + "x" + window.innerHeight,
      generatedAt: new Date().toISOString()
    };
  }

  function buildElementContext(el, index) {
    const dataAttrs = {};
    Array.from(el.attributes || []).forEach(function (attr) {
      if (attr.name.indexOf("data-") === 0 && attr.name !== ID_ATTR) {
        dataAttrs[attr.name] = attr.value;
      }
    });
    const react = getReactDebug(el);
    const shadowPath = describeShadowPath(el);
    const ctx = Object.assign({
      index: index,
      label: elementLabel(el),
      tag: el.tagName.toLowerCase(),
      selector: buildSelector(el),
      xpath: buildXPath(el),
      roleName: getRoleName(el),
      dataAttrs: dataAttrs,
      text: truncate((el.innerText || el.textContent || "").replace(/\s+/g, " ").trim(), MAX_TEXT),
      html: truncate(el.outerHTML ? el.outerHTML.replace(/\s+/g, " ").trim() : "", MAX_HTML)
    }, react);
    if (shadowPath) ctx.shadowPath = shadowPath;
    return ctx;
  }

  function describeShadowPath(el) {
    const hosts = getShadowHostChain(el);
    if (!hosts.length) return "";
    return hosts.map(function (h) { return h.tagName.toLowerCase(); }).join(" > ") + " ::shadow";
  }

  function elementLabel(el) {
    if (!el) return "unknown";
    if (el.id) return "#" + el.id;
    if (el.classList && el.classList.length) return "." + el.classList[0];
    const tag = el.tagName ? el.tagName.toLowerCase() : "node";
    const text = truncate((el.innerText || el.textContent || "").replace(/\s+/g, " ").trim(), 28);
    return text ? tag + " \"" + text + "\"" : "<" + tag + ">";
  }

  function buildSelector(el) {
    if (!el) return "";
    if (el.id && !getShadowHostChain(el).length) return "#" + cssIdent(el.id);
    // CR-008: build segment per shadow boundary, join with ' >>> '
    const segments = [];
    let cur = el;
    while (cur && cur.nodeType === Node.ELEMENT_NODE) {
      segments.unshift(buildSelectorSegment(cur));
      const root = cur.getRootNode && cur.getRootNode();
      if (root && typeof ShadowRoot !== "undefined" && root instanceof ShadowRoot && root.host) {
        cur = root.host;
      } else {
        break;
      }
    }
    return segments.join(" >>> ");
  }

  function buildSelectorSegment(el) {
    if (el.id) return "#" + cssIdent(el.id);
    const parts = [];
    let node = el;
    while (node && node.nodeType === Node.ELEMENT_NODE && node !== document.body && node !== document.documentElement) {
      let part = node.tagName.toLowerCase();
      if (node.id) {
        parts.unshift("#" + cssIdent(node.id));
        break;
      }
      const parent = node.parentElement;
      if (parent) {
        const sameTag = Array.from(parent.children).filter(function (child) {
          return child.tagName === node.tagName;
        });
        if (sameTag.length > 1) part += ":nth-of-type(" + (sameTag.indexOf(node) + 1) + ")";
      }
      parts.unshift(part);
      // Stop at shadow root boundary (parentElement is null when crossing)
      if (!parent) break;
      node = parent;
    }
    return parts.length ? parts.join(" > ") : el.tagName.toLowerCase();
  }

  function buildXPath(el) {
    if (!el) return "";
    if (el.id && !getShadowHostChain(el).length) return "//*[@id=\"" + xpathLiteral(el.id) + "\"]";
    // CR-008: build per-shadow segments, join with ' ::shadow '
    const segments = [];
    let cur = el;
    while (cur && cur.nodeType === Node.ELEMENT_NODE) {
      segments.unshift(buildXPathSegment(cur));
      const root = cur.getRootNode && cur.getRootNode();
      if (root && typeof ShadowRoot !== "undefined" && root instanceof ShadowRoot && root.host) {
        cur = root.host;
      } else {
        break;
      }
    }
    return segments.join(" ::shadow ");
  }

  function buildXPathSegment(el) {
    const parts = [];
    let node = el;
    while (node && node.nodeType === Node.ELEMENT_NODE) {
      let index = 1;
      let prev = node.previousElementSibling;
      while (prev) {
        if (prev.tagName === node.tagName) index++;
        prev = prev.previousElementSibling;
      }
      parts.unshift(node.tagName.toLowerCase() + "[" + index + "]");
      if (!node.parentElement) break;
      node = node.parentElement;
    }
    return "/" + parts.join("/");
  }

  function getRoleName(el) {
    const role = el.getAttribute("role") || implicitRole(el);
    const name = el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("alt") || el.getAttribute("placeholder") || "";
    if (!role && !name) return "";
    return [role ? "role=" + role : "", name ? "name=" + JSON.stringify(name) : ""].filter(Boolean).join(", ");
  }

  function implicitRole(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === "a" && el.hasAttribute("href")) return "link";
    if (tag === "button") return "button";
    if (tag === "input") return "textbox";
    if (tag === "select") return "combobox";
    if (tag === "textarea") return "textbox";
    if (tag === "table") return "table";
    if (/^h[1-6]$/.test(tag)) return "heading";
    return "";
  }

  const SKIP_REACT = new Set([
    "ClientPageRoot", "LinkComponent", "ServerComponent", "AppRouter",
    "Router", "HotReload", "ReactDevOverlay", "InnerLayoutRouter",
    "OuterLayoutRouter", "RedirectBoundary", "NotFoundBoundary",
    "ErrorBoundary", "LoadingBoundary", "TemplateContext",
    "ScrollAndFocusHandler", "RenderFromTemplateContext",
    "PathnameContextProviderAdapter", "Hot", "Inner", "Forward", "Root"
  ]);

  function getReactDebug(el) {
    try {
      const key = Object.keys(el).find(function (name) {
        return name.indexOf("__reactFiber") === 0 || name.indexOf("__reactInternalInstance") === 0;
      });
      if (!key) return {};
      let fiber = el[key];
      const result = {};
      let walker = fiber;
      while (walker) {
        if (walker._debugSource) {
          const src = walker._debugSource;
          const file = String(src.fileName || "").replace(/^.*?\/src\//, "src/");
          result.source = file + ":" + src.lineNumber;
          break;
        }
        walker = walker.return;
      }
      const components = [];
      walker = fiber;
      while (walker) {
        if (walker.type && typeof walker.type === "function") {
          const name = walker.type.displayName || walker.type.name;
          if (isUserComponent(name) && components.indexOf(name) === -1) {
            components.push(name);
            if (components.length >= 3) break;
          }
        }
        walker = walker.return;
      }
      if (components.length) result.react = components.reverse().join(" > ");
      return result;
    } catch (_) {
      return {};
    }
  }

  function isUserComponent(name) {
    return !!(name && name.length > 1 && !SKIP_REACT.has(name) && !/^[a-z]/.test(name) && name[0] !== "_");
  }

  function detectLocale() {
    const language = ((navigator.languages && navigator.languages[0]) || navigator.language || "en").toLowerCase();
    return language.indexOf("zh") === 0 ? "zh" : "en";
  }

  function truncate(value, max) {
    if (!value) return "";
    const suffix = locale === "zh" ? "... [已截断]" : "... [truncated]";
    return value.length > max ? value.slice(0, max) + suffix : value;
  }

  function block(value) {
    return "\n```text\n" + value.replace(/```/g, "` ` `") + "\n```";
  }

  function cssIdent(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function cssAttrEscape(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
  }

  function xpathLiteral(value) {
    return String(value).replace(/"/g, '\\"');
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
