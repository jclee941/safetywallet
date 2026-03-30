import { type ReactNode } from "react";

export function renderAnnouncementHtml(content: string): ReactNode {
  if (typeof DOMParser === "undefined") {
    return content;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(content, "text/html");

  const renderNode = (node: ChildNode, key: string): ReactNode => {
    if (node.nodeType === 3) {
      return node.textContent;
    }

    if (node.nodeType !== 1) {
      return null;
    }

    const element = node as HTMLElement;
    const children = Array.from(element.childNodes).map((child, index) =>
      renderNode(child, `${key}-${index}`),
    );

    switch (element.tagName.toLowerCase()) {
      case "h3":
        return (
          <h3
            key={key}
            className="mb-2 text-base font-semibold text-foreground"
          >
            {children}
          </h3>
        );
      case "p":
        return (
          <p key={key} className="mb-2 leading-6">
            {children}
          </p>
        );
      case "ul":
        return (
          <ul key={key} className="mb-2 list-inside list-disc space-y-1">
            {children}
          </ul>
        );
      case "li":
        return <li key={key}>{children}</li>;
      case "strong":
        return <strong key={key}>{children}</strong>;
      case "br":
        return <br key={key} />;
      default:
        return <span key={key}>{children}</span>;
    }
  };

  return Array.from(doc.body.childNodes).map((node, index) =>
    renderNode(node, `node-${index}`),
  );
}
