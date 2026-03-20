import { Box } from "@mui/material";
import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

interface EChartProps {
  option: EChartsOption;
  height?: number;
}

export function EChart({ option, height = 280 }: EChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const instance = echarts.init(containerRef.current);
    instance.setOption(option);

    const observer = new ResizeObserver(() => {
      instance.resize();
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      instance.dispose();
    };
  }, [option]);

  return <Box ref={containerRef} sx={{ width: "100%", height }} />;
}
