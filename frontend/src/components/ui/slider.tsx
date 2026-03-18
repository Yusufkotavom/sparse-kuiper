"use client"

import * as React from "react"
import { Slider as SliderPrimitive } from "@base-ui/react/slider"

import { cn } from "@/lib/utils"

function Slider({
  className,
  value,
  onValueChange,
  ...props
}: Omit<SliderPrimitive.Root.Props, "value" | "onValueChange"> & {
  value?: number[]
  onValueChange?: (value: number[]) => void
}) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      value={value}
      onValueChange={(v) => {
        if (onValueChange) {
          onValueChange(Array.isArray(v) ? v : [v])
        }
      }}
      className={cn(
        "relative flex w-full touch-none select-none items-center py-4 group",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Control className="relative w-full flex items-center">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted group-hover:bg-muted/80 transition-colors"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-indicator"
            className="absolute h-full bg-primary"
          />
        </SliderPrimitive.Track>
        {value?.map((_, i) => (
          <SliderPrimitive.Thumb
            key={i}
            data-slot="slider-thumb"
            className="block size-4 rounded-full border-2 border-primary bg-background shadow-md ring-offset-background transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-grab active:cursor-grabbing"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
