"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function normalizePath(path: string) {
  if (!path.startsWith("/")) {
    return `/${path}`;
  }

  if (path === "/") {
    return "/";
  }

  return path.replace(/\/+$/, "");
}

export default function NavLink({
  href,
  children,
  className,
  exact,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  exact?: boolean;
}) {
  const pathname = usePathname() ?? "/";
  const currentPath = normalizePath(pathname);
  const targetPath = normalizePath(href);

  const isActive = exact
    ? currentPath === targetPath
    : currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);

  return (
    <Link
      href={href}
      className={className}
      aria-current={isActive ? "page" : undefined}
      data-active={isActive ? "true" : undefined}
    >
      {children}
    </Link>
  );
}
