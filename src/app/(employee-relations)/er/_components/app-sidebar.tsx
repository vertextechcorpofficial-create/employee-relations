import * as React from "react";
import { type ComponentProps } from "react";
import { AppSidebarClient } from "@/components/shared/app-sidebar/app-sidebar-client";
import { getSidebarNavigation } from "@/actions/app-sidebar";
import { Sidebar } from "@/components/ui/sidebar";
import { NavItem } from "@/types/navigation";

interface DirectusModuleRow {
    id: number;
    title: string;
    slug: string;
    base_path: string | null;
    icon_name: string | null;
    status: string | null;
    sort: number | null;
    parent_module_id: number | null;
}

interface TreeNode extends NavItem {
    moduleId: number;
    parentModuleId: number | null;
    sort: number;
    children: TreeNode[];
}

async function fetchDirectusErModulesForDevBypass(): Promise<NavItem[]> {
    const directusBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    const directusToken = process.env.DIRECTUS_STATIC_TOKEN;
    if (!directusBase || !directusToken) return [];

    try {
        const filter = encodeURIComponent(
            JSON.stringify({ subsystem_id: { slug: { _eq: "er" } } })
        );
        const url = `${directusBase.replace(/\/+$/, "")}/items/modules?filter=${filter}&sort=sort&limit=-1`;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${directusToken}` },
            cache: "no-store",
        });
        if (!res.ok) return [];

        const json = (await res.json()) as { data?: DirectusModuleRow[] };
        const rows = json.data ?? [];
        const byId = new Map<number, TreeNode>();
        const roots: TreeNode[] = [];

        for (const row of rows) {
            byId.set(row.id, {
                moduleId: row.id,
                parentModuleId: row.parent_module_id,
                sort: row.sort ?? 0,
                title: row.title,
                url: row.base_path || "#",
                slug: row.slug,
                status: row.status || "active",
                iconName: row.icon_name || "Folder",
                children: [],
            });
        }

        for (const node of byId.values()) {
            const parent = node.parentModuleId ? byId.get(node.parentModuleId) : undefined;
            if (parent) {
                parent.children.push(node);
            } else {
                roots.push(node);
            }
        }

        const toNavItems = (nodes: TreeNode[]): NavItem[] =>
            nodes
                .sort((a, b) => a.sort - b.sort)
                .map((node) => ({
                    title: node.title,
                    url: node.url,
                    slug: node.slug,
                    status: node.status,
                    iconName: node.iconName,
                    items: node.children.length > 0 ? toNavItems(node.children) : undefined,
                }));

        return toNavItems(roots);
    } catch {
        return [];
    }
}

export async function AppSidebar(props: ComponentProps<typeof Sidebar>) {
    let items = await getSidebarNavigation("er");

    if (items.length === 0 && process.env.NEXT_PUBLIC_AUTH_DISABLED === "true") {
        items = await fetchDirectusErModulesForDevBypass();
    }

    return (
        <AppSidebarClient
            {...props}
            initialItems={items}
            subsystemTitle="Employee Relations"
        />
    );
}
