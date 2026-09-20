import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import Svg, { Path, Line, Circle, Text as SvgText, Rect, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { COLORS, formatCurrency, Transaction, Project } from '../data/demo';
import { BuildicyLogo } from '../components/BuildicyLogo';
import { supabase, subscribeToRealtimeChanges } from '../lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 48;
const CHART_HEIGHT = 180;
const MARGIN_LEFT = 40;
const MARGIN_RIGHT = 15;
const MARGIN_TOP = 20;
const MARGIN_BOTTOM = 30;
const DRAW_W = CHART_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const DRAW_H = CHART_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;

type Scenario = 'conservative' | 'expected' | 'aggressive';

interface MonthData {
  month: string;
  yearMonth: string;
  revenue: number;
  expenses: number;
  profit: number;
  isForecast?: boolean;
}

export default function Growth() {
  const router = useRouter();
  const [scenario, setScenario] = useState<Scenario>('expected');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clientCount, setClientCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchGrowthData() {
    console.log('[SUPABASE FETCH] [Growth] Querying transactions, projects & clients...');
    try {
      const { data: txs, error: tErr } = await supabase.from('transactions').select('*');
      if (tErr) throw tErr;

      const { data: projs, error: pErr } = await supabase.from('projects').select('*');
      if (pErr) throw pErr;

      const { count: cCount, error: cErr } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true });
      if (cErr) throw cErr;

      console.log(`[SUPABASE FETCH SUCCESS] Loaded ${txs?.length || 0} transactions for growth calculations`);
      setTransactions(txs || []);
      setProjects(projs || []);
      setClientCount(cCount || 0);
    } catch (err: any) {
      console.error('[SUPABASE FETCH ERROR] Growth fetch error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      console.log('[NAVIGATION FOCUS] User opened GROWTH & PROJECTIONS screen');
      fetchGrowthData();
    }, [])
  );

  useEffect(() => {
    const unsubscribe = subscribeToRealtimeChanges(() => {
      console.log('[REALTIME UPDATE] Database changed. Refetching Growth calculations...');
      fetchGrowthData();
    });
    return () => unsubscribe();
  }, []);

  const onRefresh = useCallback(() => {
    console.log('[BACKGROUND PROCESS] User refreshed Growth screen');
    setRefreshing(true);
    fetchGrowthData();
  }, []);

  // Process historical transactions into month buckets
  const historicalData = buildHistoricalMonths(transactions);
  const activeHistoricalMonths = historicalData.filter(m => m.revenue > 0 || m.expenses > 0);
  const hasEnoughData = transactions.length > 0;

  // Calculate actual growth stats
  const firstMonth = activeHistoricalMonths[0] || { revenue: 0, profit: 0, expenses: 0 };
  const lastMonth = activeHistoricalMonths[activeHistoricalMonths.length - 1] || { revenue: 0, profit: 0, expenses: 0 };

  const revenueGrowthPct = (activeHistoricalMonths.length >= 2 && firstMonth.revenue > 0)
    ? (((lastMonth.revenue - firstMonth.revenue) / firstMonth.revenue) * 100).toFixed(1)
    : '0.0';

  const profitGrowthPct = (activeHistoricalMonths.length >= 2 && firstMonth.profit > 0)
    ? (((lastMonth.profit - firstMonth.profit) / firstMonth.profit) * 100).toFixed(1)
    : '0.0';

  const totalRev = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalExp = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0);
  const currentBalance = totalRev - totalExp;

  const monthCount = activeHistoricalMonths.length || 1;
  const avgMonthlyRev = activeHistoricalMonths.reduce((s, m) => s + m.revenue, 0) / monthCount;
  const avgMonthlyExp = activeHistoricalMonths.reduce((s, m) => s + m.expenses, 0) / monthCount;

  const cashRunwayMonths = avgMonthlyExp > 0 ? (currentBalance / avgMonthlyExp).toFixed(1) : '∞';
  const avgProjectValue = projects.length > 0
    ? (projects.reduce((s, p) => s + Number(p.budget || 0), 0) / projects.length)
    : 0;

  // Build Forecast Points
  const forecastData = generateForecastPoints(avgMonthlyRev, avgMonthlyExp, scenario);
  const combinedTimeline = [...historicalData, ...forecastData];

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>CALCULATING GROWTH METRICS...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7C3AED']} tintColor="#7C3AED" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <BuildicyLogo size="small" showSubtitle={false} />
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>FORECAST ENGINE</Text>
          </View>
        </View>

        {/* Growth KPI Metrics */}
        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, { borderColor: Number(revenueGrowthPct) >= 0 ? COLORS.green : COLORS.red }]}>
            <Text style={styles.kpiLabel}>REVENUE GROWTH</Text>
            <Text style={[styles.kpiValue, { color: Number(revenueGrowthPct) >= 0 ? COLORS.green : COLORS.red }]}>
              {revenueGrowthPct}%
            </Text>
            <Text style={styles.kpiSub}>HISTORICAL MOM</Text>
          </View>

          <View style={[styles.kpiCard, { borderColor: COLORS.blue }]}>
            <Text style={styles.kpiLabel}>CASH RUNWAY</Text>
            <Text style={[styles.kpiValue, { color: COLORS.blue }]}>{cashRunwayMonths} MO</Text>
            <Text style={styles.kpiSub}>AT CURRENT BURN</Text>
          </View>

          <View style={[styles.kpiCard, { borderColor: COLORS.purple }]}>
            <Text style={styles.kpiLabel}>AVG PROJECT VALUE</Text>
            <Text style={[styles.kpiValue, { color: COLORS.purple }]}>{formatCurrency(avgProjectValue)}</Text>
            <Text style={styles.kpiSub}>{projects.length} PROJECTS</Text>
          </View>

          <View style={[styles.kpiCard, { borderColor: COLORS.yellow }]}>
            <Text style={styles.kpiLabel}>ACTIVE CLIENTS</Text>
            <Text style={[styles.kpiValue, { color: COLORS.yellow }]}>{clientCount}</Text>
            <Text style={styles.kpiSub}>REGISTERED CLIENTS</Text>
          </View>
        </View>

        {/* Interactive Growth Chart Component */}
        {!hasEnoughData ? (
          <View style={styles.emptyNoticeCard}>
            <Ionicons name="trending-up-outline" size={36} color={COLORS.yellow} />
            <Text style={styles.emptyNoticeTitle}>ADD MORE DATA TO GENERATE FORECASTS</Text>
            <Text style={styles.emptyNoticeSub}>
              We need at least 2 active months of transaction records to generate reliable growth rates and financial forecasts.
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/transactions')} activeOpacity={0.8}>
              <Text style={styles.emptyBtnText}>+ ADD HISTORICAL TRANSACTIONS</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.chartCard}>
            <View style={styles.chartCardHeader}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={styles.chartTitle}>BICY / REVENUE INDEX</Text>
                  <View style={styles.liveTag}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveTagText}>LIVE TERMINAL</Text>
                  </View>
                </View>
                <Text style={styles.chartSub}>EMERALD GREEN = DB HISTORY • NEON GOLD = 6-MO PROJECTION</Text>
              </View>
            </View>

            {/* Scenario Buttons */}
            <View style={styles.scenarioRow}>
              {(['conservative', 'expected', 'aggressive'] as const).map(sc => (
                <TouchableOpacity
                  key={sc}
                  style={[styles.scenarioBtn, scenario === sc && styles.scenarioBtnActive]}
                  onPress={() => setScenario(sc)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.scenarioBtnText, scenario === sc && styles.scenarioBtnTextActive]}>
                    {sc === 'conservative' ? 'BEARISH (+2%)' : sc === 'expected' ? 'NEUTRAL (+5%)' : 'BULLISH (+10%)'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* SVG Growth Chart */}
            <GrowthSvgChart historical={historicalData} forecast={forecastData} />

            {/* Assumption Callout */}
            <View style={styles.assumptionBox}>
              <Ionicons name="sparkles-outline" size={14} color="#A855F7" />
              <Text style={styles.assumptionText}>
                {scenario === 'conservative' && 'BEARISH TARGET: +2% MoM compound growth based on ₹' + Math.round(avgMonthlyRev).toLocaleString() + '/mo average revenue.'}
                {scenario === 'expected' && 'NEUTRAL TARGET: +5% MoM compound growth based on ₹' + Math.round(avgMonthlyRev).toLocaleString() + '/mo average revenue.'}
                {scenario === 'aggressive' && 'BULLISH TARGET: +10% MoM compound growth based on ₹' + Math.round(avgMonthlyRev).toLocaleString() + '/mo average revenue.'}
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// SVG Line Chart Component for Actual vs. Projected Growth — Stock Market Terminal Style
function GrowthSvgChart({ historical, forecast }: { historical: MonthData[]; forecast: MonthData[] }) {
  const combined = [...historical, ...forecast];
  const allVals = combined.map(m => m.revenue);
  const maxVal = Math.max(...allVals, 1000);
  const minVal = 0;

  const getX = (index: number) => {
    if (combined.length <= 1) return MARGIN_LEFT + DRAW_W / 2;
    return MARGIN_LEFT + (index / (combined.length - 1)) * DRAW_W;
  };

  const getY = (val: number) => {
    return MARGIN_TOP + DRAW_H - (val / maxVal) * DRAW_H;
  };

  // Convert array of points to smooth cubic Bézier path string
  const createSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;

    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cp1x = p0.x + (p1.x - p0.x) / 2.2;
      const cp1y = p0.y;
      const cp2x = p0.x + (p1.x - p0.x) / 2.2;
      const cp2y = p1.y;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
    }
    return d;
  };

  // Build actual historical points
  const histPts = historical.map((pt, i) => ({ x: getX(i), y: getY(pt.revenue) }));
  const actualPath = createSmoothPath(histPts);

  // Build gradient area path for historical
  const bottomY = MARGIN_TOP + DRAW_H;
  const actualAreaPath = histPts.length > 0
    ? `${actualPath} L ${histPts[histPts.length - 1].x} ${bottomY} L ${histPts[0].x} ${bottomY} Z`
    : '';

  // Forecast Path (starts at last historical point)
  const lastHistIdx = historical.length - 1;
  const forecastPts = [historical[lastHistIdx], ...forecast].map((pt, i) => {
    const globalIdx = lastHistIdx + i;
    return { x: getX(globalIdx), y: getY(pt.revenue) };
  });
  const forecastPath = createSmoothPath(forecastPts);
  const forecastAreaPath = forecastPts.length > 0
    ? `${forecastPath} L ${forecastPts[forecastPts.length - 1].x} ${bottomY} L ${forecastPts[0].x} ${bottomY} Z`
    : '';

  const lastActualPt = histPts[histPts.length - 1] || { x: MARGIN_LEFT, y: getY(0) };
  const lastActualVal = historical[historical.length - 1]?.revenue || 0;

  return (
    <View style={{ alignItems: 'center', marginVertical: 8 }}>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        <Defs>
          {/* Historical Green Area Fill Gradient */}
          <LinearGradient id="stockGreenArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#10B981" stopOpacity="0.45" />
            <Stop offset="75%" stopColor="#10B981" stopOpacity="0.08" />
            <Stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
          </LinearGradient>

          {/* Forecast Neon Yellow/Purple Area Fill Gradient */}
          <LinearGradient id="forecastYellowArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#A855F7" stopOpacity="0.3" />
            <Stop offset="100%" stopColor="#7C3AED" stopOpacity="0.0" />
          </LinearGradient>
        </Defs>

        {/* Stock Chart Gridlines */}
        {[0, 0.33, 0.66, 1].map((ratio, idx) => {
          const y = MARGIN_TOP + DRAW_H * (1 - ratio);
          return (
            <React.Fragment key={idx}>
              <Line
                x1={MARGIN_LEFT}
                y1={y}
                x2={MARGIN_LEFT + DRAW_W}
                y2={y}
                stroke="#1F2937"
                strokeWidth="1"
                strokeDasharray={idx === 0 || idx === 3 ? undefined : '2 4'}
              />
              <SvgText
                x={MARGIN_LEFT - 6}
                y={y + 3}
                fontSize="8"
                fontWeight="900"
                fill="#9CA3AF"
                textAnchor="end"
              >
                {formatCurrency(maxVal * ratio)}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Volume Bars at Bottom (Stock Market Style Volume Histogram) */}
        {combined.map((pt, i) => {
          const x = getX(i);
          const volRatio = Math.min(pt.revenue / maxVal, 1);
          const barH = Math.max(volRatio * 28, 4);
          const isFc = i >= historical.length;
          return (
            <Rect
              key={`vol-${i}`}
              x={x - 4}
              y={bottomY - barH}
              width={8}
              height={barH}
              fill={isFc ? '#7C3AED' : '#10B981'}
              opacity={0.25}
              rx={1}
            />
          );
        })}

        {/* Target Horizontal Reference Line from Current Value */}
        {lastActualPt && (
          <Line
            x1={MARGIN_LEFT}
            y1={lastActualPt.y}
            x2={MARGIN_LEFT + DRAW_W}
            y2={lastActualPt.y}
            stroke="#10B981"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity={0.6}
          />
        )}

        {/* Forecast Zone Divider Vertical Line */}
        <Line
          x1={lastActualPt.x}
          y1={MARGIN_TOP}
          x2={lastActualPt.x}
          y2={bottomY}
          stroke="#A855F7"
          strokeWidth="1"
          strokeDasharray="3 3"
          opacity={0.8}
        />

        {/* Forecast Area Fill */}
        {forecastAreaPath !== '' && (
          <Path d={forecastAreaPath} fill="url(#forecastYellowArea)" />
        )}

        {/* Historical Area Fill */}
        {actualAreaPath !== '' && (
          <Path d={actualAreaPath} fill="url(#stockGreenArea)" />
        )}

        {/* Glowing Wide Under-Strokes */}
        <Path d={actualPath} stroke="#10B981" strokeWidth="6" strokeOpacity="0.2" fill="none" />
        <Path d={forecastPath} stroke="#A855F7" strokeWidth="5" strokeOpacity="0.25" fill="none" />

        {/* Sharp Foreground Lines */}
        <Path d={actualPath} stroke="#10B981" strokeWidth="3" fill="none" />
        <Path d={forecastPath} stroke="#FACC15" strokeWidth="2.5" strokeDasharray="5 5" fill="none" />

        {/* Historical Data Node Circles */}
        {histPts.map((pt, i) => (
          <Circle
            key={`hist-pt-${i}`}
            cx={pt.x}
            cy={pt.y}
            r="3.5"
            fill="#0B0F17"
            stroke="#10B981"
            strokeWidth="2"
          />
        ))}

        {/* Forecast Data Node Circles */}
        {forecastPts.slice(1).map((pt, i) => (
          <Circle
            key={`fc-pt-${i}`}
            cx={pt.x}
            cy={pt.y}
            r="3.5"
            fill="#0B0F17"
            stroke="#FACC15"
            strokeWidth="2"
          />
        ))}

        {/* Pulsing Stock Cursor on Last Actual Value */}
        <Circle cx={lastActualPt.x} cy={lastActualPt.y} r="8" fill="#10B981" opacity={0.3} />
        <Circle cx={lastActualPt.x} cy={lastActualPt.y} r="4.5" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />

        {/* Current Price Tag Badge on Chart */}
        <G x={Math.min(lastActualPt.x - 28, DRAW_W - 40)} y={Math.max(lastActualPt.y - 20, MARGIN_TOP)}>
          <Rect x="0" y="0" width="56" height="15" fill="#10B981" rx="3" />
          <SvgText x="28" y="10.5" fontSize="8" fontWeight="900" fill="#0B0F17" textAnchor="middle">
            {formatCurrency(lastActualVal)}
          </SvgText>
        </G>

        {/* X Axis Month Labels */}
        {combined.map((pt, i) => {
          const x = getX(i);
          const y = bottomY + 16;
          const isFc = i >= historical.length;
          return (
            <SvgText
              key={`x-label-${i}`}
              x={x}
              y={y}
              fontSize="8"
              fontWeight="900"
              fill={isFc ? '#FACC15' : '#E5E7EB'}
              textAnchor="middle"
            >
              {pt.month}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

// Helpers
function buildHistoricalMonths(transactions: Transaction[]): MonthData[] {
  const monthsMap: Record<string, MonthData> = {};
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();

  // Create last 6 months buckets by default
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mName = monthNames[d.getMonth()];
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthsMap[key] = { month: mName, yearMonth: key, revenue: 0, expenses: 0, profit: 0 };
  }

  transactions.forEach(tx => {
    if (!tx.date) return;

    let key = '';
    let mName = '';
    const parts = String(tx.date).split('-');
    if (parts.length >= 2) {
      const year = parseInt(parts[0], 10);
      const monthIdx = parseInt(parts[1], 10) - 1;
      if (!isNaN(year) && !isNaN(monthIdx) && monthIdx >= 0 && monthIdx < 12) {
        key = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
        mName = monthNames[monthIdx];
      }
    }

    if (!key) {
      const d = new Date(tx.date);
      if (isNaN(d.getTime())) return;
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      mName = monthNames[d.getMonth()];
    }

    if (!monthsMap[key]) {
      monthsMap[key] = { month: mName, yearMonth: key, revenue: 0, expenses: 0, profit: 0 };
    }

    const amt = Number(tx.amount || 0);
    if (tx.type === 'income') monthsMap[key].revenue += amt;
    if (tx.type === 'expense') monthsMap[key].expenses += amt;
    monthsMap[key].profit = monthsMap[key].revenue - monthsMap[key].expenses;
  });

  return Object.values(monthsMap).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
}

function generateForecastPoints(avgRev: number, avgExp: number, scenario: Scenario): MonthData[] {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();

  const rates = {
    conservative: 0.02,
    expected: 0.05,
    aggressive: 0.10,
  };

  const rate = rates[scenario];
  const points: MonthData[] = [];

  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const mName = monthNames[d.getMonth()];
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const rev = Math.round(avgRev * Math.pow(1 + rate, i));
    const exp = Math.round(avgExp * Math.pow(1 + (rate * 0.5), i));

    points.push({
      month: `${mName}*`,
      yearMonth: key,
      revenue: rev,
      expenses: exp,
      profit: rev - exp,
      isForecast: true,
    });
  }

  return points;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadingText: { marginTop: 12, fontSize: 10, fontWeight: '900', color: COLORS.text, letterSpacing: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  headerBadge: { borderWidth: 1.5, borderColor: '#7C3AED', backgroundColor: '#0B0F17', paddingHorizontal: 8, paddingVertical: 4 },
  headerBadgeText: { fontSize: 8, fontWeight: '900', color: '#A855F7', letterSpacing: 1.5 },
  title: { fontSize: 28, fontWeight: '900', color: COLORS.text, letterSpacing: -1 },
  subtitle: { fontSize: 9, fontWeight: '900', color: COLORS.muted, letterSpacing: 1.5, marginTop: 2 },
  
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  kpiCard: { width: (SCREEN_WIDTH - 40) / 2, backgroundColor: COLORS.card, borderWidth: 2, padding: 14 },
  kpiLabel: { fontSize: 8, fontWeight: '900', color: COLORS.muted, letterSpacing: 1.5, marginBottom: 4 },
  kpiValue: { fontSize: 22, fontWeight: '900', letterSpacing: -1, marginBottom: 2 },
  kpiSub: { fontSize: 8, fontWeight: '800', color: COLORS.muted, letterSpacing: 1 },
  
  emptyNoticeCard: { marginHorizontal: 16, backgroundColor: COLORS.card, borderWidth: 2, borderColor: COLORS.border, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyNoticeTitle: { fontSize: 11, fontWeight: '900', color: COLORS.text, textAlign: 'center', letterSpacing: 1 },
  emptyNoticeSub: { fontSize: 11, fontWeight: '700', color: COLORS.muted, textAlign: 'center', lineHeight: 16 },
  emptyBtn: { backgroundColor: COLORS.yellow, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 2, borderColor: COLORS.border, marginTop: 8 },
  emptyBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  
  chartCard: { marginHorizontal: 16, backgroundColor: '#0B0F17', borderWidth: 2, borderColor: '#7C3AED', padding: 16 },
  chartCardHeader: { marginBottom: 12 },
  chartTitle: { fontSize: 13, fontWeight: '900', color: '#F3F4F6', letterSpacing: 1 },
  chartSub: { fontSize: 8, fontWeight: '800', color: '#9CA3AF', letterSpacing: 0.5 },
  
  liveTag: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(16, 185, 129, 0.15)', borderWidth: 1, borderColor: '#10B981', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  liveTagText: { fontSize: 7, fontWeight: '900', color: '#10B981', letterSpacing: 1 },

  scenarioRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  scenarioBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderWidth: 1.5, borderColor: '#374151', backgroundColor: '#111827' },
  scenarioBtnActive: { backgroundColor: '#7C3AED', borderColor: '#A855F7' },
  scenarioBtnText: { fontSize: 8, fontWeight: '900', color: '#9CA3AF', letterSpacing: 0.8 },
  scenarioBtnTextActive: { color: '#FFFFFF' },
  
  assumptionBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#111827', borderWidth: 1.5, borderColor: '#374151', padding: 10, marginTop: 4 },
  assumptionText: { flex: 1, fontSize: 10, fontWeight: '700', color: '#E5E7EB', lineHeight: 14 },
});
