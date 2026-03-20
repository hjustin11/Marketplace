import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

interface EChartProps {
  option: EChartsOption;
  height?: number;
}

export function EChart({ option, height = 280 }: EChartProps) {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);
  const animationsEnabled = document.documentElement.dataset.chartAnimations !== "off";

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    if (!instanceRef.current) {
      instanceRef.current = echarts.init(containerRef.current);
    }

    const baseOption: EChartsOption = {
      animation: animationsEnabled,
      animationDuration: animationsEnabled ? 650 : 0,
      animationDurationUpdate: animationsEnabled ? 420 : 0,
      animationEasing: "cubicOut",
      textStyle: {
        color: theme.palette.text.secondary,
        fontFamily: theme.typography.fontFamily,
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.9)",
        borderWidth: 0,
        textStyle: { color: "#fff" },
      },
    };

    instanceRef.current.setOption(
      {
        ...baseOption,
        ...option,
      },
      true,
    );

    const observer = new ResizeObserver(() => {
      instanceRef.current?.resize();
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [animationsEnabled, option, theme.palette.text.secondary, theme.typography.fontFamily]);

  useEffect(() => {
    return () => {
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  return <Box ref={containerRef} sx={{ width: "100%", height }} />;
}
