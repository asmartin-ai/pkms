import { defineRule, eslintCompatPlugin } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

function removalRange(text: string, comment: ESTree.Comment): [number, number] {
  const lineStart = text.lastIndexOf("\n", comment.start - 1) + 1;
  const newline = text.indexOf("\n", comment.end);
  const lineEnd = newline === -1 ? text.length : newline;
  const before = text.slice(lineStart, comment.start);
  const after = text.slice(comment.end, lineEnd);

  if (before.trim() === "" && after.trim() === "")
    return [lineStart, newline === -1 ? lineEnd : newline + 1];

  if (after.trim() === "") return [comment.start - (before.length - before.trimEnd().length), comment.end];

  return [comment.start, comment.end];
}

const noCommentsRule = defineRule({
  meta: {
    type: "suggestion",
    fixable: "code",
    docs: { description: "Code carries no comments; explanations live in docs and tests." },
    messages: { comment: "Remove this comment. Put the explanation in docs or a test name." },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          if (comment.type === "Shebang") continue;
          const range = removalRange(sourceCode.text, comment);

          context.report({
            loc: comment.loc,
            messageId: "comment",
            fix: (fixer) => fixer.removeRange(range),
          });
        }
      },
    };
  },
});

export default eslintCompatPlugin({
  meta: { name: "khaos" },
  rules: { "no-comments": noCommentsRule },
});
