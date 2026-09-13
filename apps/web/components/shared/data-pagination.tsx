"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/spectrumui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/spectrumui/select";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [10, 25, 50, 100];

/**
 * §12.6 One pagination footer for every list screen. It sits under the table,
 * never inside it, so the numbers stay in the same place on every page: a
 * left-aligned range sentence, then page size + step controls on the right.
 *
 * Server-side paging: the table renders exactly the rows it is handed and this
 * footer drives `page` / `pageSize` back through the list hook, so the URL and
 * the request always agree.
 */
export function DataPagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
}) {
  const safeTotalPages = Math.max(1, totalPages);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t border-border/60 px-1 py-3 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="tabular-nums">
        {total === 0 ? (
          "No rows"
        ) : (
          <>
            Showing <span className="font-medium text-foreground">{from}</span>–
            <span className="font-medium text-foreground">{to}</span> of{" "}
            <span className="font-medium text-foreground">{total}</span>
          </>
        )}
      </p>

      <div className="flex items-center gap-2">
        {onPageSizeChange ? (
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger
              aria-label="Rows per page"
              className="h-8 w-[104px] text-[13px]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <span className="hidden text-[13px] tabular-nums sm:inline">
          Page {page} of {safeTotalPages}
        </span>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next page"
            disabled={page >= safeTotalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
