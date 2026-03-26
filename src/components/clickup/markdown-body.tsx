export function MarkdownBody({ content }: { content: string }) {
  return (
    <div
      className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
      dangerouslySetInnerHTML={{
        __html: content
          .replace(/## (.+)/g, '<h3 class="font-bold text-gray-900 dark:text-white mt-3 mb-1 text-sm">$1</h3>')
          .replace(/### (.+)/g, '<h4 class="font-semibold text-gray-800 dark:text-gray-200 mt-2 mb-1 text-sm">$1</h4>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/^- (.+)/gm, '<li class="ml-4 list-disc">$1</li>')
          .replace(/^\d+\. (.+)/gm, '<li class="ml-4 list-decimal">$1</li>')
          .replace(/\n/g, '<br/>'),
      }}
    />
  );
}
