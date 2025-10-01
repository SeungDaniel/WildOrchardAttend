
"use client";

import Link from "next/link";
import { QrCode, Camera, User } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function Header() {
  const pathname = usePathname();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  const navLinks = [
    { href: "/", label: "Manual", icon: QrCode },
    { href: "/camera", label: "Camera", icon: Camera },
    { href: "/personal", label: "Personal", icon: User },
  ];
  
  const isPersonalMode = pathname.startsWith(`${basePath}/personal`);
  const title = isPersonalMode ? "코드 입력" : "Ezra 출석체크";

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <QrCode className="h-6 w-6 text-primary" />
        </Link>
        <nav className="flex items-center space-x-2 sm:space-x-4">
          {navLinks.map((link) => {
            const isActive = link.href === '/' 
              ? pathname === `${basePath}${link.href}` || pathname === `${basePath}/`
              : pathname.startsWith(`${basePath}${link.href}`);
            
            return (
              <Button
                key={link.href}
                variant="ghost"
                asChild
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Link href={link.href} className="flex items-center gap-2">
                  <link.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{link.label}</span>
                </Link>
              </Button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
