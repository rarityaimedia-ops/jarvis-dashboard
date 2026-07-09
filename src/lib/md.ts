import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import type { Root, Text, InlineCode } from "mdast";
import type { Node } from "unist";

/** Strip frontmatter and parse markdown into an mdast tree. */
export function parseMd(src: string): Root {
  const { content } = matter(src);
  return unified().use(remarkParse).use(remarkGfm).parse(content);
}

/** Concatenated text content of a node (text + inline code). */
export function textOf(node: Node): string {
  let s = "";
  visit(node, (n) => {
    if (n.type === "text" || n.type === "inlineCode") {
      s += (n as Text | InlineCode).value;
    }
  });
  return s.replace(/\s+/g, " ").trim();
}
