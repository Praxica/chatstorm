import Link from 'next/link';
import React, { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const NonMemoizedMarkdown = ({ children }: { children: string }) => {
  const components: Partial<Components> = {
    code: ({ node: _node, className, children, ...props }) => {
      const match = /language-(\w+)/.exec(className || '');
      return match ? (
        <pre
          className={`${className} text-sm w-[80dvw] md:max-w-[500px] overflow-x-scroll bg-zinc-100 p-3 rounded-lg mt-2 dark:bg-zinc-800`}
        >
          <code className={match[1]}>{children}</code>
        </pre>
      ) : (
        <code
          className={`${className} text-sm bg-zinc-100 dark:bg-zinc-800 py-0.5 px-1 rounded-md`}
          {...props}
        >
          {children}
        </code>
      );
    },
    ol: ({ node: _node, children, ...props }) => {
      return (
        <ol className="list-decimal list-outside ml-4 my-2" {...props}>
          {children}
        </ol>
      );
    },
    ul: ({ node: _node, children, ...props }) => {
      return (
        <ul className="list-disc list-outside ml-4 my-2" {...props}>
          {children}
        </ul>
      );
    },
    li: ({ node: _node, children, ...props }) => {
      return (
        <li className="py-1 pl-1" {...props}>
          {children}
        </li>
      );
    },
    strong: ({ node: _node, children, ...props }) => {
      return (
        <strong 
          className="font-semibold text-zinc-900 dark:text-zinc-100" 
          {...props}
        >
          {children}
        </strong>
      );
    },
    a: ({ node: _node, children, href, ..._props }) => {
      return (
        <Link
          href={href ?? ''}
          className="text-blue-500 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          {children}
        </Link>
      );
    },
    h1: ({ node: _node, children, ...props }) => {
      return (
        <h1 className="text-3xl font-semibold mt-6 mb-2" {...props}>
          {children}
        </h1>
      );
    },
    h2: ({ node: _node, children, ...props }) => {
      return (
        <h2 className="text-2xl font-semibold mt-6 mb-2" {...props}>
          {children}
        </h2>
      );
    },
    h3: ({ node: _node, children, ...props }) => {
      return (
        <h3 className="text-xl font-semibold mt-6 mb-2" {...props}>
          {children}
        </h3>
      );
    },
    h4: ({ node: _node, children, ...props }) => {
      return (
        <h4 className="text-lg font-semibold mt-6 mb-2" {...props}>
          {children}
        </h4>
      );
    },
    h5: ({ node: _node, children, ...props }) => {
      return (
        <h5 className="text-base font-semibold mt-6 mb-2" {...props}>
          {children}
        </h5>
      );
    },
    h6: ({ node: _node, children, ...props }) => {
      return (
        <h6 className="text-sm font-semibold mt-6 mb-2" {...props}>
          {children}
        </h6>
      );
    },
    p: ({ node: _node, children, ...props }) => {
      return (
        <p className="mb-4 last:mb-0" {...props}>
          {children}
        </p>
      );
    },
  };

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
};

export const Markdown = memo(
  NonMemoizedMarkdown,
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);
