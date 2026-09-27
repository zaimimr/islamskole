"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"

import { cn } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from "lucide-react"

const Select = SelectPrimitive.Root

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1 py-1 first:pt-0 last:pb-0", className)}
      {...props}
    />
  )
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn(
        "min-w-0 flex-1 truncate text-left data-placeholder:text-[#6A716C] dark:data-placeholder:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "group/select-trigger flex w-fit min-w-0 cursor-pointer items-center justify-between gap-2 rounded-xl border border-[#CFC8BA] bg-white pr-3 pl-3.5 text-left text-base whitespace-nowrap text-foreground transition-[border-color,background-color,box-shadow] outline-none select-none hover:border-[#B3AB9B] hover:bg-[#FDFCF9] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 data-popup-open:border-ring data-popup-open:ring-3 data-popup-open:ring-ring/15 disabled:cursor-not-allowed disabled:border-[#DDD8CD] disabled:bg-[#F4F2EC] disabled:text-[#6A716C] aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15 data-invalid:border-destructive data-placeholder:text-[#6A716C] data-[size=default]:min-h-11 data-[size=sm]:min-h-9 data-[size=sm]:rounded-lg data-[size=sm]:pl-3 data-[size=sm]:text-sm sm:text-sm dark:border-input dark:bg-input/30 dark:hover:bg-input/50 dark:data-placeholder:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          <ChevronDownIcon
            aria-hidden="true"
            className="size-4 text-[#5A625C] transition-transform duration-150 group-data-popup-open/select-trigger:rotate-180 group-disabled/select-trigger:text-[#9AA09B] motion-reduce:transition-none dark:text-muted-foreground"
          />
        }
      />
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 6,
  align = "start",
  alignOffset = 0,
  alignItemWithTrigger = false,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        collisionPadding={12}
        className="isolate z-50 outline-none"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn(
            "relative isolate z-50 max-h-[min(var(--available-height),22rem)] w-max max-w-[min(26rem,calc(100vw-24px))] min-w-[max(var(--anchor-width),11rem)] origin-(--transform-origin) overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl bg-popover p-1.5 text-popover-foreground shadow-[0_18px_40px_-18px_rgb(22_48_28/0.35),0_3px_8px_-4px_rgb(22_48_28/0.12)] ring-1 ring-[#1F3A24]/10 outline-none duration-150 [scrollbar-color:#CFC8BA_transparent] [scrollbar-width:thin] data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.98] data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-[0.98] motion-reduce:animate-none dark:ring-foreground/15",
            className
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List className="outline-none">
            {children}
          </SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn(
        "px-3 pt-2 pb-1 text-xs font-bold tracking-wide text-[#5A625C] dark:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  description,
  ...props
}: SelectPrimitive.Item.Props & { description?: React.ReactNode }) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex min-h-11 w-full cursor-pointer flex-col justify-center rounded-lg py-2 pr-9 pl-3 text-base text-foreground outline-none select-none sm:min-h-10 sm:text-sm data-highlighted:bg-[#EEF4E9] data-highlighted:text-[#163B1C] data-selected:font-semibold data-selected:text-[#1F5A28] data-disabled:cursor-not-allowed data-disabled:text-[#8C928D] data-disabled:data-highlighted:bg-transparent dark:data-highlighted:bg-muted dark:data-highlighted:text-foreground dark:data-selected:text-primary",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="block min-w-0 break-words">
        {children}
      </SelectPrimitive.ItemText>
      {description ? (
        <span className="mt-0.5 block text-sm font-normal text-[#5A625C] sm:text-xs dark:text-muted-foreground">
          {description}
        </span>
      ) : null}
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute top-1/2 right-3 flex size-4 -translate-y-1/2 items-center justify-center text-[#2F7938] dark:text-primary" />
        }
      >
        <CheckIcon aria-hidden="true" className="size-4" strokeWidth={2.5} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1.5 my-1.5 h-px bg-[#E6E1D6] dark:bg-border", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 text-[#5A625C] [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronUpIcon aria-hidden="true" />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 text-[#5A625C] [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronDownIcon aria-hidden="true" />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
