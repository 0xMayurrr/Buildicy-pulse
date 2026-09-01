import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  GestureResponderEvent,
} from 'react-native';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Line,
  Circle,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { COLORS, formatCurrency, formatFullCurrency, Transaction } from '../data/demo';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 48; // Padding 24 on each side inside container card
const CHART_HEIGHT = 200;
const MARGIN_LEFT = 45;
const MARGIN_RIGHT = 15;
const MARGIN_TOP = 20;
const MARGIN_BOTTOM = 30;

const DRAW_WIDTH = CHART_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const DRAW_HEIGHT = CHART_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;

const TIME_FILTERS = ['7D', '30D', '3M', '6M', '1Y'];

interface ChartPoint {
  dateStr: string;
  displayDate: string;
  revenue: number;
  expenses: number;
  profit: number;
}

interface Props {
  transactions: Transaction[];
  timeFilter: string;
  onTimeFilterChange: (filter: string) => void;
  onAddTransactionPress?: () => void;
}

export function InteractiveFinanceChart({
  transactions,
  timeFilter,
  onTimeFilterChange,
  onAddTransactionPress,
}: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // 1. Build Data Points based on TimeFilter
  const dataPoints = buildDataPoints(transactions, timeFilter);
  const hasData = transactions.length > 0 && dataPoints.some(p => p.revenue > 0 || p.expenses > 0);

  // 2. Compute Max Value for Y-Axis
  const allValues = dataPoints.flatMap(p => [p.revenue, p.expenses, Math.abs(p.profit)]);
  const maxVal = Math.max(...allValues, 1000);

  // 3. Coordinate Converters
  const getX = (index: number) => {
    if (dataPoints.length <= 1) return MARGIN_LEFT + DRAW_WIDTH / 2;
    return MARGIN_LEFT + (index / (dataPoints.length - 1)) * DRAW_WIDTH;
  };

  const getY = (val: number) => {
    return MARGIN_TOP + DRAW_HEIGHT - (Math.max(val, 0) / maxVal) * DRAW_HEIGHT;
  };

  // 4. Generate SVG Paths
  const createPath = (key: 'revenue' | 'expenses' | 'profit') => {
    if (dataPoints.length === 0) return '';
    return dataPoints.reduce((acc, pt, i) => {
      const x = getX(i);
      const y = getY(pt[key]);
      return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, '');
  };

  const createAreaPath = (key: 'revenue' | 'expenses') => {
    if (dataPoints.length === 0) return '';
    const linePath = createPath(key);
    const lastX = getX(dataPoints.length - 1);
    const firstX = getX(0);
    const bottomY = MARGIN_TOP + DRAW_HEIGHT;
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  };

  const revPath = createPath('revenue');
  const expPath = createPath('expenses');
  const profPath = createPath('profit');

  const revArea = createAreaPath('revenue');
  const expArea = createAreaPath('expenses');

  // Touch Gesture Handling
  const handleTouch = (event: GestureResponderEvent) => {
    if (dataPoints.length === 0) return;
    const touchX = event.nativeEvent.locationX;
    const relativeX = touchX - MARGIN_LEFT;
    const clampedX = Math.max(0, Math.min(relativeX, DRAW_WIDTH));
    const rawIndex = Math.round((clampedX / DRAW_WIDTH) * (dataPoints.length - 1));
    const index = Math.max(0, Math.min(rawIndex, dataPoints.length - 1));
    setSelectedIndex(index);
  };

  const selectedPt = selectedIndex !== null ? dataPoints[selectedIndex] : null;

  return (
    <View style={styles.container}>
      {/* Header with Title & Filter Buttons */}
      <View style={styles.chartHeader}>
        <View>
          <Text style={styles.chartTitle}>FINANCIAL CASH FLOW</Text>
          <Text style={styles.chartSubtitle}>
            {hasData ? 'LIVE SUPABASE TRANSACTIONS' : 'NO TRANSACTIONS RECORDED'}
          </Text>
        </View>
        <View style={styles.filterRow}>
          {TIME_FILTERS.map(tf => (
            <TouchableOpacity
              key={tf}
              style={[styles.filterChip, timeFilter === tf && styles.activeFilterChip]}
              onPress={() => {
                setSelectedIndex(null);
                onTimeFilterChange(tf);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterChipText, timeFilter === tf && styles.activeFilterChipText]}>
                {tf}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Legend Header */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.green }]} />
          <Text style={styles.legendText}>REVENUE</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.red }]} />
          <Text style={styles.legendText}>EXPENSES</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.yellow }]} />
          <Text style={styles.legendText}>PROFIT</Text>
        </View>
      </View>

      {/* Selected Point Tooltip Banner */}
      {selectedPt ? (
        <View style={styles.tooltipBanner}>
          <View style={styles.tooltipBannerLeft}>
            <Ionicons name="calendar" size={14} color={COLORS.text} />
            <Text style={styles.tooltipDateText}>{selectedPt.displayDate}</Text>
          </View>
          <View style={styles.tooltipMetricsRow}>
            <Text style={[styles.tooltipMetricVal, { color: COLORS.green }]}>
              +{formatCurrency(selectedPt.revenue)}
            </Text>
            <Text style={[styles.tooltipMetricVal, { color: COLORS.red }]}>
              -{formatCurrency(selectedPt.expenses)}
            </Text>
            <Text style={[styles.tooltipMetricVal, { color: COLORS.yellow }]}>
              {formatCurrency(selectedPt.profit)}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Interactive SVG Canvas */}
      <View
        style={styles.svgWrapper}
        onStartShouldSetResponder={() => true}
        onResponderGrant={handleTouch}
        onResponderMove={handleTouch}
        onResponderRelease={() => {}}
      >
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
          <Defs>
            <LinearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={COLORS.green} stopOpacity={0.3} />
              <Stop offset="100%" stopColor={COLORS.green} stopOpacity={0.0} />
            </LinearGradient>
            <LinearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={COLORS.red} stopOpacity={0.3} />
              <Stop offset="100%" stopColor={COLORS.red} stopOpacity={0.0} />
            </LinearGradient>
          </Defs>

          {/* Y-Axis Gridlines & Labels */}
          {[0, 0.33, 0.66, 1].map((ratio, idx) => {
            const y = MARGIN_TOP + DRAW_HEIGHT * (1 - ratio);
            const val = maxVal * ratio;
            return (
              <React.Fragment key={idx}>
                <Line
                  x1={MARGIN_LEFT}
                  y1={y}
                  x2={MARGIN_LEFT + DRAW_WIDTH}
                  y2={y}
                  stroke="#E5E7EB"
                  strokeWidth="1"
                  strokeDasharray={ratio === 0 ? undefined : '4 4'}
                />
                <SvgText
                  x={MARGIN_LEFT - 6}
                  y={y + 4}
                  fontSize="9"
                  fontWeight="800"
                  fill="#6B7280"
                  textAnchor="end"
                >
                  {formatCurrency(val)}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* X-Axis Dates */}
          {dataPoints.map((pt, i) => {
            // Show every Nth label to avoid overlap
            const step = Math.ceil(dataPoints.length / 5);
            if (i % step !== 0 && i !== dataPoints.length - 1) return null;
            const x = getX(i);
            const y = MARGIN_TOP + DRAW_HEIGHT + 18;
            return (
              <SvgText
                key={i}
                x={x}
                y={y}
                fontSize="9"
                fontWeight="800"
                fill="#6B7280"
                textAnchor="middle"
              >
                {pt.displayDate}
              </SvgText>
            );
          })}

          {/* Area Fills */}
          {hasData && <Path d={revArea} fill="url(#revGrad)" />}
          {hasData && <Path d={expArea} fill="url(#expGrad)" />}

          {/* Lines */}
          {hasData && <Path d={revPath} stroke={COLORS.green} strokeWidth="3" fill="none" />}
          {hasData && <Path d={expPath} stroke={COLORS.red} strokeWidth="3" fill="none" />}
          {hasData && (
            <Path
              d={profPath}
              stroke={COLORS.yellow}
              strokeWidth="2.5"
              strokeDasharray="4 4"
              fill="none"
            />
          )}

          {/* Selected Point Crosshair */}
          {selectedIndex !== null && (
            <>
              <Line
                x1={getX(selectedIndex)}
                y1={MARGIN_TOP}
                x2={getX(selectedIndex)}
                y2={MARGIN_TOP + DRAW_HEIGHT}
                stroke="#111827"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <Circle
                cx={getX(selectedIndex)}
                cy={getY(dataPoints[selectedIndex].revenue)}
                r="5"
                fill={COLORS.green}
                stroke="#FFFFFF"
                strokeWidth="2"
              />
              <Circle
                cx={getX(selectedIndex)}
                cy={getY(dataPoints[selectedIndex].expenses)}
                r="5"
                fill={COLORS.red}
                stroke="#FFFFFF"
                strokeWidth="2"
              />
            </>
          )}
        </Svg>
      </View>

      {/* Empty State Overlay */}
      {!hasData && (
        <View style={styles.emptyStateContainer}>
          <Ionicons name="analytics-outline" size={32} color={COLORS.muted} />
          <Text style={styles.emptyStateTitle}>NO TRANSACTIONS FOUND</Text>
          <Text style={styles.emptyStateSubtitle}>
            Add income or expense records to populate your trading chart live.
          </Text>
          {onAddTransactionPress && (
            <TouchableOpacity
              style={styles.emptyAddBtn}
              onPress={onAddTransactionPress}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={styles.emptyAddBtnText}>RECORD TRANSACTION</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// Helper to group transactions into timeline buckets
function buildDataPoints(transactions: Transaction[], timeFilter: string): ChartPoint[] {
  const now = new Date();
  let daysCount = 7;
  if (timeFilter === '30D') daysCount = 30;
  if (timeFilter === '3M') daysCount = 90;
  if (timeFilter === '6M') daysCount = 180;
  if (timeFilter === '1Y') daysCount = 365;

  const pointsMap: Record<string, ChartPoint> = {};
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (daysCount <= 30) {
    // Day by Day
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const displayDate = `${d.getDate()} ${monthNames[d.getMonth()]}`;
      pointsMap[key] = { dateStr: key, displayDate, revenue: 0, expenses: 0, profit: 0 };
    }
  } else {
    // Month by Month
    const months = daysCount / 30;
    for (let i = Math.ceil(months) - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const displayDate = monthNames[d.getMonth()];
      pointsMap[key] = { dateStr: key, displayDate, revenue: 0, expenses: 0, profit: 0 };
    }
  }

  // Aggregate actual transactions
  transactions.forEach(tx => {
    if (!tx.date) return;
    const amt = Number(tx.amount || 0);

    let key = tx.date;
    if (daysCount > 30) {
      const txDate = new Date(tx.date);
      if (!isNaN(txDate.getTime())) {
        key = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
      }
    }

    if (pointsMap[key]) {
      if (tx.type === 'income') {
        pointsMap[key].revenue += amt;
      } else if (tx.type === 'expense') {
        pointsMap[key].expenses += amt;
      }
      pointsMap[key].profit = pointsMap[key].revenue - pointsMap[key].expenses;
    }
  });

  return Object.values(pointsMap).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 0,
    elevation: 4,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 1.5,
  },
  chartSubtitle: {
    fontSize: 8,
    fontWeight: '800',
    color: COLORS.muted,
    letterSpacing: 1,
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 4,
  },
  filterChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#F3F4F6',
  },
  activeFilterChip: {
    backgroundColor: COLORS.border,
  },
  filterChipText: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.text,
  },
  activeFilterChipText: {
    color: '#FFFFFF',
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  tooltipBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
  },
  tooltipBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tooltipDateText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.text,
  },
  tooltipMetricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tooltipMetricVal: {
    fontSize: 11,
    fontWeight: '900',
  },
  svgWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  emptyStateTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 1,
    marginTop: 4,
  },
  emptyStateSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.muted,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.yellow,
    borderWidth: 2,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 10,
  },
  emptyAddBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
