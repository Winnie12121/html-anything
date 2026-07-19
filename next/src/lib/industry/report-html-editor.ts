const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "HEAD",
  "META",
  "LINK",
  "TITLE",
  "BASE",
]);

const VOID_TAGS = new Set([
  "AREA",
  "BASE",
  "BR",
  "COL",
  "EMBED",
  "HR",
  "IMG",
  "INPUT",
  "LINK",
  "META",
  "PARAM",
  "SOURCE",
  "TRACK",
  "WBR",
]);

export type ReportHtmlBlock = {
  id: string;
  tag: string;
  text: string;
};

export type ParsedReportHtml = {
  skeleton: string;
  blocks: ReportHtmlBlock[];
};

export function parseReportHtml(html: string): ParsedReportHtml {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks: ReportHtmlBlock[] = [];
  let counter = 0;
  const nextId = () => `b${++counter}`;

  function tagElement(el: Element): string {
    if (!el.hasAttribute("data-block-id")) el.setAttribute("data-block-id", nextId());
    return el.getAttribute("data-block-id") ?? nextId();
  }

  function tagTextLeaf(el: Element, text: string, tagName?: string) {
    const id = tagElement(el);
    el.setAttribute("data-hce-text", "1");
    blocks.push({ id, tag: (tagName ?? el.tagName).toLowerCase(), text });
  }

  function walk(el: Element) {
    if (SKIP_TAGS.has(el.tagName)) return;
    if (VOID_TAGS.has(el.tagName)) {
      tagElement(el);
      return;
    }

    tagElement(el);
    const childNodes = Array.from(el.childNodes);
    const hasElementChild = childNodes.some((node) => node.nodeType === Node.ELEMENT_NODE);

    if (!hasElementChild) {
      const text = el.textContent ?? "";
      if (text.trim()) tagTextLeaf(el, text);
      return;
    }

    for (const child of childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.nodeValue ?? "";
        if (!text.trim()) continue;
        const span = doc.createElement("span");
        span.setAttribute("data-text-leaf", "1");
        span.textContent = text;
        el.insertBefore(span, child);
        el.removeChild(child);
        tagTextLeaf(span, text, "span");
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child as Element);
      }
    }
  }

  if (doc.body) walk(doc.body);
  return {
    skeleton: serializeDocument(doc),
    blocks,
  };
}

export function renderReportHtmlForEditor(
  skeleton: string,
  blocks: ReportHtmlBlock[],
): string {
  const doc = new DOMParser().parseFromString(skeleton, "text/html");
  const textById = new Map(blocks.map((block) => [block.id, block.text]));

  doc.querySelectorAll("[data-hce-text]").forEach((el) => {
    const id = el.getAttribute("data-block-id");
    if (id && textById.has(id)) el.textContent = textById.get(id) ?? "";
  });

  return serializeDocument(doc);
}

export function reassembleReportHtml(
  skeleton: string,
  blocks: ReportHtmlBlock[],
): string {
  const doc = new DOMParser().parseFromString(skeleton, "text/html");
  const textById = new Map(blocks.map((block) => [block.id, block.text]));

  doc.querySelectorAll("[data-hce-text]").forEach((el) => {
    const id = el.getAttribute("data-block-id");
    if (id && textById.has(id)) el.textContent = textById.get(id) ?? "";
  });

  doc.querySelectorAll("span[data-text-leaf]").forEach((el) => {
    el.replaceWith(doc.createTextNode(el.textContent ?? ""));
  });

  doc.querySelectorAll("[data-block-id]").forEach((el) => {
    el.removeAttribute("data-block-id");
    el.removeAttribute("data-hce-text");
    el.removeAttribute("data-hce-selected");
    el.removeAttribute("data-commented");
    el.removeAttribute("contenteditable");
    el.removeAttribute("spellcheck");
  });

  return serializeDocument(doc);
}

function serializeDocument(doc: Document): string {
  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}
