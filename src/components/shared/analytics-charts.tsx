"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Color palette
const CHART_COLORS = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--secondary))",
  success: "#22c55e",
  warning: "#f59e0b",
  error: "#ef4444",
  info: "#3b82f6",
  muted: "hsl(var(--muted-foreground))",
};

const PIE_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

interface ChartContainerProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export function ChartContainer({
  title,
  description,
  children,
  className,
  action,
}: ChartContainerProps) {
  return (
    <Card className={cn("", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base font-medium">{title}</CardTitle>
          {description && (
            <CardDescription className="text-sm">{description}</CardDescription>
          )}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// Area Chart for trends
interface AreaChartData {
  name: string;
  value: number;
  value2?: number;
}

interface TrendAreaChartProps {
  data: AreaChartData[];
  title: string;
  description?: string;
  dataKey?: string;
  dataKey2?: string;
  color?: string;
  color2?: string;
  height?: number;
  showGrid?: boolean;
  className?: string;
}

export function TrendAreaChart({
  data,
  title,
  description,
  dataKey = "value",
  dataKey2,
  color = CHART_COLORS.primary,
  color2 = CHART_COLORS.success,
  height = 300,
  showGrid = true,
  className,
}: TrendAreaChartProps) {
  return (
    <ChartContainer title={title} description={description} className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            fill={color}
            fillOpacity={0.2}
            strokeWidth={2}
          />
          {dataKey2 && (
            <Area
              type="monotone"
              dataKey={dataKey2}
              stroke={color2}
              fill={color2}
              fillOpacity={0.2}
              strokeWidth={2}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

// Bar Chart for comparisons
interface BarChartData {
  name: string;
  value: number;
  value2?: number;
}

interface ComparisonBarChartProps {
  data: BarChartData[];
  title: string;
  description?: string;
  dataKey?: string;
  dataKey2?: string;
  color?: string;
  color2?: string;
  height?: number;
  horizontal?: boolean;
  className?: string;
}

export function ComparisonBarChart({
  data,
  title,
  description,
  dataKey = "value",
  dataKey2,
  color = CHART_COLORS.primary,
  color2 = CHART_COLORS.success,
  height = 300,
  horizontal = false,
  className,
}: ComparisonBarChartProps) {
  return (
    <ChartContainer title={title} description={description} className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          {horizontal ? (
            <>
              <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={80}
              />
            </>
          ) : (
            <>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
            </>
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
          />
          <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
          {dataKey2 && <Bar dataKey={dataKey2} fill={color2} radius={[4, 4, 0, 0]} />}
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

// Line Chart for time series
interface LineChartData {
  name: string;
  [key: string]: string | number;
}

interface TimeSeriesLineChartProps {
  data: LineChartData[];
  title: string;
  description?: string;
  lines: { dataKey: string; color: string; name?: string }[];
  height?: number;
  showLegend?: boolean;
  className?: string;
}

export function TimeSeriesLineChart({
  data,
  title,
  description,
  lines,
  height = 300,
  showLegend = true,
  className,
}: TimeSeriesLineChartProps) {
  return (
    <ChartContainer title={title} description={description} className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
          />
          {showLegend && <Legend />}
          {lines.map((line, index) => (
            <Line
              key={index}
              type="monotone"
              dataKey={line.dataKey}
              stroke={line.color}
              strokeWidth={2}
              dot={false}
              name={line.name || line.dataKey}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

// Pie Chart for distributions
interface PieChartData {
  name: string;
  value: number;
}

interface DistributionPieChartProps {
  data: PieChartData[];
  title: string;
  description?: string;
  height?: number;
  innerRadius?: number;
  showLegend?: boolean;
  className?: string;
}

export function DistributionPieChart({
  data,
  title,
  description,
  height = 300,
  innerRadius = 0,
  showLegend = true,
  className,
}: DistributionPieChartProps) {
  return (
    <ChartContainer title={title} description={description} className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
            labelLine={false}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
          />
          {showLegend && <Legend />}
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

// Donut chart (pie with inner radius)
export function DonutChart(props: Omit<DistributionPieChartProps, "innerRadius">) {
  return <DistributionPieChart {...props} innerRadius={60} />;
}

// Stats with sparkline
interface SparklineStatsProps {
  title: string;
  value: string | number;
  change?: number;
  data: number[];
  className?: string;
}

export function SparklineStats({ title, value, change, data, className }: SparklineStatsProps) {
  const chartData = data.map((v, i) => ({ value: v, index: i }));
  const isPositive = change !== undefined && change >= 0;

  return (
    <Card className={cn("", className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {change !== undefined && (
              <p className={cn("text-xs", isPositive ? "text-green-600" : "text-red-600")}>
                {isPositive ? "+" : ""}
                {change}%
              </p>
            )}
          </div>
          <div className="w-24 h-12">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={isPositive ? CHART_COLORS.success : CHART_COLORS.error}
                  fill={isPositive ? CHART_COLORS.success : CHART_COLORS.error}
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Mini trend indicator
interface MiniTrendProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}

export function MiniTrend({ data, color = CHART_COLORS.primary, width = 60, height = 20 }: MiniTrendProps) {
  const chartData = data.map((v, i) => ({ value: v, index: i }));

  return (
    <ResponsiveContainer width={width} height={height}>
      <LineChart data={chartData}>
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
