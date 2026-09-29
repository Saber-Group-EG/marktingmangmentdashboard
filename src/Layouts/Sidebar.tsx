import { forwardRef, useEffect } from "react";
import { cn } from "../utils/cn";
import Logo from "../assets/logo.jpg";
import { navbarLinks } from "../constants";
import { NavLink, useLocation } from "react-router-dom";
import { logout } from "../api/requests/authService";
import { useLang } from "../hooks/useLang";

interface SidebarProps {
    collapsed: boolean;
    setCollapsed: (v: boolean) => void;
}

export const Sidebar = forwardRef<HTMLDivElement, SidebarProps>(({ collapsed, setCollapsed }, ref) => {
    const { lang, t } = useLang();
    const isArabic = lang === "ar";
    const location = useLocation();
    const isAdmin = (() => {
        try {
            return JSON.parse(localStorage.getItem("auth-user") || "null")?.role === "admin";
        } catch {
            return false;
        }
    })();

    // 🧠 Close sidebar automatically on route change (mobile)
    useEffect(() => {
        if (window.innerWidth < 768) setCollapsed(true);
    }, [location.pathname, setCollapsed]);

    const borderSide = isArabic ? "border-l" : "border-r";
    const desktopPosition = isArabic ? "right-0 left-auto" : "left-0 right-auto";
    const mobileOffset = isArabic ? (collapsed ? "max-md:-right-full" : "max-md:right-0") : collapsed ? "max-md:-left-full" : "max-md:left-0";

    return (
        <>
            {/* 🌓 Mobile backdrop */}
            <div
                onClick={() => setCollapsed(true)}
                className={cn(
                    "fixed inset-0 z-[90] bg-black/40 transition-opacity md:hidden",
                    collapsed ? "pointer-events-none opacity-0" : "opacity-100",
                )}
            />

            {/* 🧭 Sidebar */}
            <aside
                ref={ref}
                dir={isArabic ? "rtl" : "ltr"}
                className={cn(
                    "shadow:sm dark:bg-dark-900 fixed z-[100] flex h-full w-[240px] flex-col overflow-x-hidden bg-white transition-all duration-300 ease-in-out",
                    borderSide,
                    "border-dark-200 dark:border-dark-700",
                    desktopPosition,
                    collapsed ? "md:w-20 md:items-center" : "md:w-[240px]",
                    mobileOffset,
                )}
            >
                {/* Logo */}
                <div className={cn("flex items-center gap-x-3 p-4", isArabic && "flex-row-reverse")}>
                    <img
                        src={Logo}
                        alt="Logo"
                        className={cn("h-6 w-auto object-contain md:h-8")}
                    />
                    {!collapsed && (
                        <p
                            className={cn(
                                "text-light-900 dark:text-dark-50 w-full text-lg font-medium transition-colors",
                                isArabic ? "text-right" : "text-left",
                            )}
                        >
                            {t("app_name")}
                        </p>
                    )}
                </div>

                {/* Navigation */}
                <div className="sidebar-scroll flex w-full flex-col gap-y-4 overflow-x-hidden overflow-y-auto p-3">
                    {navbarLinks.map((navbarLink) => (
                        <nav
                            key={navbarLink.title}
                            className={cn("sidebar-group", collapsed && "md:items-center")}
                        >
                            <p className={cn("sidebar-group-title w-full", collapsed && "md:w-[45px]", isArabic ? "text-right" : "text-left")}>
                                {t(navbarLink.title)}
                            </p>

                            {navbarLink.links.filter((link: any) => !link.adminOnly || isAdmin).map((link) => {
                                // Render logout link as a button that calls the auth API
                                if (link.path === "/logout") {
                                    return (
                                        <button
                                            key={link.label}
                                            type="button"
                                            onClick={async () => {
                                                try {
                                                    await logout();
                                                } catch (err) {
                                                    // ignore errors - we still want to redirect to login
                                                } finally {
                                                    // Redirect to login page (full reload to clear state)
                                                    window.location.href = "/auth/login";
                                                }
                                            }}
                                            className={cn(
                                                "sidebar-item flex items-center justify-start gap-x-3",
                                                collapsed && "md:w-[45px]",
                                                isArabic && "flex-row-reverse justify-end",
                                            )}
                                        >
                                            {(() => {
                                                const Icon = (link.icon as any) || null;
                                                return Icon ? (
                                                    <Icon
                                                        size={22}
                                                        className={cn("flex-shrink-0", isArabic ? "order-2 ml-2" : "order-1 mr-2")}
                                                    />
                                                ) : null;
                                            })()}

                                            {!collapsed && (
                                                <span
                                                    className={cn("w-full whitespace-nowrap", isArabic ? "order-1 text-right" : "order-2 text-left")}
                                                >
                                                    {t(link.label)}
                                                </span>
                                            )}
                                        </button>
                                    );
                                }

                                return (
                                    <NavLink
                                        key={link.label}
                                        to={link.path}
                                        end
                                        className={({ isActive }) =>
                                            cn(
                                                "sidebar-item flex items-center justify-start gap-x-3",
                                                collapsed && "md:w-[45px]",
                                                isArabic && "flex-row-reverse justify-end",
                                                isActive && "active",
                                            )
                                        }
                                        onClick={() => {
                                            // Only auto-close sidebar on small screens (mobile/tablet)
                                            if (typeof window !== "undefined" && window.innerWidth < 768) {
                                                setCollapsed(true);
                                            }
                                        }}
                                    >
                                        {(() => {
                                            const Icon = (link.icon as any) || null;
                                            return Icon ? (
                                                <Icon
                                                    size={22}
                                                    className={cn("flex-shrink-0", isArabic ? "order-2 ml-2" : "order-1 mr-2")}
                                                />
                                            ) : null;
                                        })()}

                                        {!collapsed && (
                                            <span className={cn("w-full whitespace-nowrap", isArabic ? "order-1 text-right" : "order-2 text-left")}>
                                                {t(link.label)}
                                            </span>
                                        )}
                                    </NavLink>
                                );
                            })}
                        </nav>
                    ))}
                </div>
            </aside>
        </>
    );
});

Sidebar.displayName = "Sidebar";
