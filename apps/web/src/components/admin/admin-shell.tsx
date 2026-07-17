"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import styles from "./admin.module.css";

const navItems = [
  { href: "/admin/sources", label: "Sources" },
  { href: "/admin/runs", label: "Ingestion runs" },
  { href: "/admin/review", label: "Review queue" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className={styles.adminCanvas}>
      <a className={styles.skipLink} href="#admin-main">Skip to operations content</a>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <Link className={styles.wordmark} href="/admin/sources" aria-label="WorkIndex operations home">
            Work<span>Index</span>
          </Link>
          <span className={styles.environment}>Fixture environment</span>
          <Link className={styles.publicLink} href="/">View public site ↗</Link>
        </div>
      </header>
      <div className={styles.adminLayout}>
        <aside className={styles.sidebar}>
          <p className={styles.navLabel}>Operations</p>
          <nav aria-label="Operations navigation">
            {navItems.map((item) => {
              const isCurrent = pathname.startsWith(item.href);
              return <Link aria-current={isCurrent ? "page" : undefined} className={isCurrent ? styles.currentNav : undefined} href={item.href} key={item.href}>{item.label}</Link>;
            })}
          </nav>
          <div className={styles.fixtureNotice}>
            <strong>Demo read model</strong>
            <p>Actions are staged in the interface only. No source or review record is persisted.</p>
          </div>
        </aside>
        <main className={styles.main} id="admin-main">{children}</main>
      </div>
    </div>
  );
}

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  meta,
}: {
  eyebrow: string;
  title: string;
  description: string;
  meta?: ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {meta ? <div className={styles.headerMeta}>{meta}</div> : null}
    </header>
  );
}

