import { describe, expect, it } from "vitest";
import {
  parseReportHtml,
  reassembleReportHtml,
  renderReportHtmlForEditor,
} from "../report-html-editor";

describe("report html editor utilities", () => {
  it("parses editable text blocks and renders editor attributes", () => {
    const parsed = parseReportHtml(
      "<!doctype html><html><body><main><h1>Talent Report</h1><p>Hello <strong>market</strong>.</p></main></body></html>",
    );

    expect(parsed.blocks.map((block) => block.text)).toEqual(
      expect.arrayContaining(["Talent Report", "Hello ", "market", "."]),
    );
    expect(parsed.skeleton).toContain("data-block-id");
    expect(parsed.skeleton).toContain("data-hce-text");

    const editorHtml = renderReportHtmlForEditor(parsed.skeleton, [
      ...parsed.blocks.slice(0, 1),
      { ...parsed.blocks[1]!, text: "Updated " },
      ...parsed.blocks.slice(2),
    ]);
    expect(editorHtml).toContain("Updated ");
  });

  it("reassembles clean html after text edits", () => {
    const parsed = parseReportHtml(
      "<!doctype html><html><body><section><h2>Old title</h2><p>Original copy.</p></section></body></html>",
    );
    const nextBlocks = parsed.blocks.map((block) =>
      block.text === "Old title" ? { ...block, text: "New title" } : block,
    );
    const html = reassembleReportHtml(parsed.skeleton, nextBlocks);

    expect(html).toContain("<h2>New title</h2>");
    expect(html).toContain("<p>Original copy.</p>");
    expect(html).not.toContain("data-block-id");
    expect(html).not.toContain("data-hce-text");
    expect(html).not.toContain("data-text-leaf");
  });
});
