/**
 * Entropy Deck Renderer — PptxGenJS
 *
 * Reads a JSON payload from stdin:
 *   { "slides": [...], "global_theme": { "bg": "#FFFFFF", "accent": "#0070F3", "font": "Arial" } }
 *
 * Each slide object follows this schema:
 *   {
 *     "index": <number>,
 *     "layout": "title" | "content" | "two_column" | "image" | "blank",
 *     "title": "<string>",
 *     "body": ["<bullet>", ...],
 *     "notes": "<string>",
 *     "theme": { "bg": "<hex>", "accent": "<hex>" }
 *   }
 *
 * Writes the rendered .pptx binary to stdout.
 * Writes errors as JSON to stderr and exits with code 1.
 *
 * Usage (called by Python deck_service.py via asyncio.create_subprocess_exec):
 *   echo '<json>' | node index.js
 */

"use strict";

const pptxgen = require("pptxgenjs");

// ── Layout helpers ────────────────────────────────────────────────────────────

/** Strip leading '#' if present and ensure 6-digit hex. */
function hexColor(raw) {
  if (!raw || typeof raw !== "string") return "FFFFFF";
  const s = raw.replace(/^#/, "").trim();
  return s.length === 6 ? s.toUpperCase() : "FFFFFF";
}

/**
 * Render a "title" slide: large centered title + optional subtitle from body[0].
 */
function renderTitleSlide(prs, slideObj, theme) {
  const s = prs.addSlide();
  s.background = { color: hexColor(theme.bg) };

  const accent = hexColor(theme.accent);
  const font = theme.font || "Arial";

  if (slideObj.title) {
    s.addText(slideObj.title, {
      x: 0.5,
      y: 2.0,
      w: "90%",
      h: 1.5,
      fontSize: 36,
      bold: true,
      color: accent,
      fontFace: font,
      align: "center",
      rtlMode: true,
    });
  }

  if (slideObj.body && slideObj.body.length > 0) {
    s.addText(slideObj.body[0], {
      x: 0.5,
      y: 3.8,
      w: "90%",
      h: 0.8,
      fontSize: 18,
      color: "555555",
      fontFace: font,
      align: "center",
      rtlMode: true,
    });
  }

  if (slideObj.notes) {
    s.addNotes(slideObj.notes);
  }
}

/**
 * Render a "content" slide: title bar + bulleted body text.
 */
function renderContentSlide(prs, slideObj, theme) {
  const s = prs.addSlide();
  s.background = { color: hexColor(theme.bg) };

  const accent = hexColor(theme.accent);
  const font = theme.font || "Arial";

  // Title bar accent strip
  s.addShape(prs.ShapeType.rect, {
    x: 0,
    y: 0,
    w: "100%",
    h: 0.08,
    fill: { color: accent },
    line: { color: accent, width: 0 },
  });

  if (slideObj.title) {
    s.addText(slideObj.title, {
      x: 0.3,
      y: 0.15,
      w: "94%",
      h: 0.75,
      fontSize: 22,
      bold: true,
      color: accent,
      fontFace: font,
      rtlMode: true,
    });
  }

  if (slideObj.body && slideObj.body.length > 0) {
    const bulletLines = slideObj.body.map((line) => ({
      text: line,
      options: { bullet: { type: "bullet" }, fontSize: 14, color: "363636", rtlMode: true },
    }));
    s.addText(bulletLines, {
      x: 0.3,
      y: 1.1,
      w: "94%",
      h: 4.5,
      fontFace: font,
      valign: "top",
    });
  }

  if (slideObj.notes) {
    s.addNotes(slideObj.notes);
  }
}

/**
 * Render a "two_column" slide: title + body split evenly into two columns.
 */
function renderTwoColumnSlide(prs, slideObj, theme) {
  const s = prs.addSlide();
  s.background = { color: hexColor(theme.bg) };

  const accent = hexColor(theme.accent);
  const font = theme.font || "Arial";

  s.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: "100%", h: 0.08,
    fill: { color: accent }, line: { color: accent, width: 0 },
  });

  if (slideObj.title) {
    s.addText(slideObj.title, {
      x: 0.3, y: 0.15, w: "94%", h: 0.75,
      fontSize: 22, bold: true, color: accent, fontFace: font, rtlMode: true,
    });
  }

  const body = slideObj.body || [];
  const mid = Math.ceil(body.length / 2);
  const left = body.slice(0, mid);
  const right = body.slice(mid);

  const colOpts = (items) =>
    items.map((line) => ({
      text: line,
      options: { bullet: { type: "bullet" }, fontSize: 13, color: "363636", rtlMode: true },
    }));

  if (left.length) {
    s.addText(colOpts(left), { x: 0.3, y: 1.1, w: "44%", h: 4.5, fontFace: font, valign: "top" });
  }
  if (right.length) {
    s.addText(colOpts(right), { x: 5.1, y: 1.1, w: "44%", h: 4.5, fontFace: font, valign: "top" });
  }

  // Vertical divider
  s.addShape(prs.ShapeType.line, {
    x: 4.9, y: 1.1, w: 0, h: 4.3,
    line: { color: "DDDDDD", width: 1 },
  });

  if (slideObj.notes) {
    s.addNotes(slideObj.notes);
  }
}

/**
 * Render a "blank" slide: background colour only, no text elements.
 */
function renderBlankSlide(prs, slideObj, theme) {
  const s = prs.addSlide();
  s.background = { color: hexColor(theme.bg) };

  if (slideObj.notes) {
    s.addNotes(slideObj.notes);
  }
}

// ── Main render function ──────────────────────────────────────────────────────

async function render(payload) {
  const { slides, global_theme } = payload;

  if (!Array.isArray(slides) || slides.length === 0) {
    throw new Error("'slides' must be a non-empty array");
  }

  const prs = new pptxgen();
  prs.layout = "LAYOUT_WIDE"; // 13.3 × 7.5 inches (16:9)
  prs.author = "Entropy RFP Platform";
  prs.company = "Entropy";

  const theme = {
    bg: global_theme?.bg || "#FFFFFF",
    accent: global_theme?.accent || "#0070F3",
    font: global_theme?.font || "Arial",
  };

  for (const slide of slides) {
    const layout = (slide.layout || "content").toLowerCase();

    switch (layout) {
      case "title":
        renderTitleSlide(prs, slide, theme);
        break;
      case "two_column":
        renderTwoColumnSlide(prs, slide, theme);
        break;
      case "blank":
        renderBlankSlide(prs, slide, theme);
        break;
      default:
        // "content", "image", and any unknown layouts fall through to content
        renderContentSlide(prs, slide, theme);
    }
  }

  // pptxgenjs write() returns a Buffer when outputType is "nodebuffer"
  return prs.write({ outputType: "nodebuffer" });
}

// ── Entry point: read JSON from stdin, write .pptx to stdout ─────────────────

let inputData = "";
process.stdin.setEncoding("utf8");

process.stdin.on("data", (chunk) => {
  inputData += chunk;
});

process.stdin.on("end", async () => {
  try {
    if (!inputData.trim()) {
      throw new Error("No input received on stdin");
    }

    const payload = JSON.parse(inputData);
    const pptxBuffer = await render(payload);

    process.stdout.write(pptxBuffer);
    process.exit(0);
  } catch (err) {
    process.stderr.write(
      JSON.stringify({ error: err.message, stack: err.stack })
    );
    process.exit(1);
  }
});
