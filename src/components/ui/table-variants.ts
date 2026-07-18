import { cva } from "class-variance-authority";

export const tableVariants = cva(
  "w-full caption-bottom text-sm",
  {
    variants: {
      variant: {
        default: "",
        striped: "[&_tbody_tr:nth-child(even)]:bg-muted/10",
        bordered: "[&_th]:border [&_th]:border-border [&_td]:border [&_td]:border-border",
        compact: "[&_th]:p-2 [&_th]:text-xs [&_td]:p-2 [&_td]:text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);
