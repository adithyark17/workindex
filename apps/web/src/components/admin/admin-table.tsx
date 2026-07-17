import type { ReactNode } from "react";
import styles from "./admin.module.css";

export function AdminTable({
  caption,
  headings,
  children,
}: {
  caption: string;
  headings: Array<{ label: string; className?: string }>;
  children: ReactNode;
}) {
  return (
    <div className={styles.tableScroller} tabIndex={0} role="region" aria-label={`${caption}. Scroll horizontally to see all columns.`}>
      <table className={styles.table}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>{headings.map((heading) => <th className={heading.className} key={heading.label} scope="col">{heading.label}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

