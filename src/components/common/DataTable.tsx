"use client";

import { useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";

import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { TableSkeleton } from "./Skeleton";
import { cn } from "@/lib/cn";

/**
 * DataTable per PPM design system section 8.
 *
 * Wraps TanStack Table v8 with the studio's chrome: optional toolbar
 * (search + filter pills + right-aligned actions), sticky header, hoverable
 * rows that route through an onRowClick, and bottom pagination.
 */

interface FilterPill {
  id: string;
  label: string;
  predicate: (row: unknown) => boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  loading?: boolean;
  globalFilterPlaceholder?: string;
  filterPills?: FilterPill[];
  actions?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
  pageSize?: number;
}

export function DataTable<T>({
  data,
  columns,
  loading,
  globalFilterPlaceholder = "Search...",
  filterPills,
  actions,
  emptyTitle = "No rows",
  emptyDescription,
  onRowClick,
  pageSize = 25,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [activePillId, setActivePillId] = useState<string | null>(null);

  const activePill = filterPills?.find((p) => p.id === activePillId) ?? null;
  const filteredData = activePill ? data.filter(activePill.predicate as (row: T) => boolean) : data;

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const totalRows = table.getFilteredRowModel().rows.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageRowCount = table.getRowModel().rows.length;
  const rangeStart = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const rangeEnd = pageIndex * pageSize + pageRowCount;

  if (loading) return <TableSkeleton rows={Math.min(pageSize, 6)} />;

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-lg border border-border p-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
          />
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={globalFilterPlaceholder}
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-surface-input text-body-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-colors"
          />
        </div>
        {filterPills && filterPills.length > 0 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActivePillId(null)}
              className={cn(
                "px-2.5 py-1.5 rounded text-body-sm transition-colors",
                activePillId === null
                  ? "bg-brand-500 text-white"
                  : "text-text-secondary hover:bg-surface-muted"
              )}
            >
              All
            </button>
            {filterPills.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActivePillId(p.id)}
                className={cn(
                  "px-2.5 py-1.5 rounded text-body-sm transition-colors",
                  activePillId === p.id
                    ? "bg-brand-500 text-white"
                    : "text-text-secondary hover:bg-surface-muted"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      <div className="bg-white rounded-lg border border-border shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" role="grid">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-border bg-surface-muted">
                  {hg.headers.map((h) => {
                    const canSort = h.column.getCanSort();
                    return (
                      <th
                        key={h.id}
                        className="px-3 py-2.5 text-left text-label uppercase text-text-secondary font-medium"
                      >
                        {h.isPlaceholder ? null : canSort ? (
                          <button
                            type="button"
                            onClick={h.column.getToggleSortingHandler()}
                            className="flex items-center gap-1 hover:text-text-primary transition-colors"
                          >
                            {flexRender(
                              h.column.columnDef.header,
                              h.getContext()
                            )}
                            <ArrowUpDown size={11} className="opacity-60" />
                          </button>
                        ) : (
                          flexRender(h.column.columnDef.header, h.getContext())
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={table.getAllColumns().length}>
                    <EmptyState
                      variant="inline"
                      title={emptyTitle}
                      description={emptyDescription}
                    />
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    className={cn(
                      "border-b border-border last:border-0 transition-colors",
                      onRowClick
                        ? "cursor-pointer hover:bg-surface-muted/50"
                        : ""
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-3 text-body-sm">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalRows > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-body-sm text-text-secondary">
              Showing {rangeStart}-{rangeEnd} of {totalRows}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="secondary"
                size="sm"
                iconOnly
                icon={<ChevronLeft size={14} />}
                aria-label="Previous page"
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
              />
              <Button
                variant="secondary"
                size="sm"
                iconOnly
                icon={<ChevronRight size={14} />}
                aria-label="Next page"
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
