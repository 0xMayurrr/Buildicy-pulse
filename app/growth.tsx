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
import Svg, { Path, Line, Circle, Text as SvgText, Rect } from 'react-native-svg';
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
  const hasEnoughData = transactions.length > 0 && activeHistoricalMonths.length >= 2;

  // Calculate actual growth stats
  const firstMonth = activeHistoricalMonths[0] || { revenue: 0, profit: 0, expenses: 0 };
  const lastMonth = activeHistoricalMonths[activeHistoricalMonths.length - 1] || { revenue: 0, profit: 0, expenses: 0 };

  const revenueGrowthPct = firstMonth.revenue > 0
    ? (((lastMonth.revenue - firstMonth.revenue) / firstMonth.revenue) * 100).toFixed(1)
    : '0.0';

  const profitGrowthPct = firstMonth.profit > 0
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
                <Text style={styles.chartTitle}>ACTUAL VS. PROJECTED REVENUE</Text>
                <Text style={styles.chartSub}>SOLID = ACTUAL DB HISTORY | DASHED = 6-MONTH PROJECTION</Text>
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
                    {sc.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* SVG Growth Chart */}
            <GrowthSvgChart historical={historicalData} forecast={forecastData} />

            {/* Assumption Callout */}
            <View style={styles.assumptionBox}>
              <Ionicons name="information-circle-outline" size={14} color={COLORS.text} />
              <Text style={styles.assumptionText}>
                {scenario === 'conservative' && 'Conservative assumption: +2% MoM compound revenue growth based on ₹' + Math.round(avgMonthlyRev).toLocaleString() + '/mo average.'}
                {scenario === 'expected' && 'Expected assumption: +5% MoM compound revenue growth based on ₹' + Math.round(avgMonthlyRev).toLocaleString() + '/mo average.'}
                {scenario === 'aggressive' && 'Aggressive assumption: +10% MoM compound revenue growth based on ₹' + Math.round(avgMonthlyRev).toLocaleString() + '/mo average.'}
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// SVG Line Chart Component for Actual vs. Projected Growth
function GrowthSvgChart({ historical, forecast }: { historical: MonthData[]; forecast: MonthData[] }) {
  const combined = [...historical, ...forecast];
  const allVals = combined.map(m => m.revenue);
  const maxVal = Math.max(...allVals, 1000);

  const getX = (index: number) => {
    if (combined.length <= 1) return MARGIN_LEFT + DRAW_W / 2;
    return MARGIN_LEFT + (index / (combined.length - 1)) * DRAW_W;
  };

  const getY = (val: number) => {
    return MARGIN_TOP + DRAW_H - (val / maxVal) * DRAW_H;
  };

  // Actual Path
  const actualPath = historical.reduce((acc, pt, i) => {
    const x = getX(i);
    const y = getY(pt.revenue);
    return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, '');

  // Forecast Path (starts at last historical point)
  const lastHistIndex = historical.length - 1;
  const forecastPath = [historical[lastHistIndex], ...forecast].reduce((acc, pt, i) => {
    const globalIdx = lastHistIndex + i;
    const x = getX(globalIdx);
    const y = getY(pt.revenue);
    return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, '');

  return (
    <View style={{ alignItems: 'center', marginVertical: 12 }}>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        {/* Y Gridlines */}
        {[0, 0.5, 1].map((ratio, idx) => {
          const y = MARGIN_TOP + DRAW_H * (1 - ratio);
          return (
            <React.Fragment key={idx}>
              <Line x1={MARGIN_LEFT} y1={y} x2={MARGIN_LEFT + DRAW_W} y2={y} stroke="#E5E7EB" strokeWidth="1" strokeDasharray="3 3" />
              <SvgText x={MARGIN_LEFT - 6} y={y + 4} fontSize="9" fontWeight="800" fill="#6B7280" textAnchor="end">
                {formatCurrency(maxVal * ratio)}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Forecast Zone Highlight */}
        {forecast.length > 0 && (
          <Rect
            x={getX(lastHistIndex)}
            y={MARGIN_TOP}
            width={DRAW_W - (getX(lastHistIndex) - MARGIN_LEFT)}
            height={DRAW_H}
            fill="#FEF3C7"
            opacity={0.4}
          />
        )}

        {/* Actual Line */}
        <Path d={actualPath} stroke={COLORS.green} strokeWidth="3" fill="none" />

        {/* Forecast Line */}
        <Path d={forecastPath} stroke={COLORS.yellow} strokeWidth="2.5" strokeDasharray="5 5" fill="none" />

        {/* Data Dots */}
        {combined.map((pt, i) => {
          const x = getX(i);
          const y = getY(pt.revenue);
          const isFc = i >= historical.length;
          return (
            <Circle
              key={i}
              cx={x}
              cy={y}
              r="4"
              fill={isFc ? COLORS.yellow : COLORS.green}
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
          );
        })}

        {/* X Date Labels */}
        {combined.map((pt, i) => {
          const x = getX(i);
          const y = MARGIN_TOP + DRAW_H + 18;
          return (
            <SvgText key={i} x={x} y={y} fontSize="8" fontWeight="800" fill={i >= historical.length ? COLORS.yellow : COLORS.text} textAnchor="middle">
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

  // Create last 6 months
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mName = monthNames[d.getMonth()];
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthsMap[key] = { month: mName, yearMonth: key, revenue: 0, expenses: 0, profit: 0 };
  }

  transactions.forEach(tx => {
    if (!tx.date) return;
    const d = new Date(tx.date);
    if (isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const amt = Number(tx.amount || 0);

    if (monthsMap[key]) {
      if (tx.type === 'income') monthsMap[key].revenue += amt;
      if (tx.type === 'expense') monthsMap[key].expenses += amt;
      monthsMap[key].profit = monthsMap[key].revenue - monthsMap[key].expenses;
    }
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
  
  chartCard: { marginHorizontal: 16, backgroundColor: COLORS.card, borderWidth: 2, borderColor: COLORS.border, padding: 16 },
  chartCardHeader: { marginBottom: 12 },
  chartTitle: { fontSize: 12, fontWeight: '900', color: COLORS.text, letterSpacing: 1 },
  chartSub: { fontSize: 8, fontWeight: '800', color: COLORS.muted, letterSpacing: 0.5, marginTop: 2 },
  
  scenarioRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  scenarioBtn: { flex: 1, paddingVertical: 6, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#F3F4F6' },
  scenarioBtnActive: { backgroundColor: COLORS.border },
  scenarioBtnText: { fontSize: 9, fontWeight: '900', color: COLORS.text, letterSpacing: 1 },
  scenarioBtnTextActive: { color: '#FFFFFF' },
  
  assumptionBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8F9FA', borderWidth: 1.5, borderColor: COLORS.border, padding: 10, marginTop: 4 },
  assumptionText: { flex: 1, fontSize: 10, fontWeight: '700', color: COLORS.text, lineHeight: 14 },
});
