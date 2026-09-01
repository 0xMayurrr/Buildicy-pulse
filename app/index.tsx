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
import { COLORS, formatCurrency, formatFullCurrency } from '../data/demo';
import { supabase, subscribeToRealtimeChanges } from '../lib/supabase';
import { InteractiveFinanceChart } from '../components/InteractiveFinanceChart';

import { BuildicyLogo } from '../components/BuildicyLogo';

const { width } = Dimensions.get('window');

export default function Dashboard() {
  const router = useRouter();
  const [timeFilter, setTimeFilter] = useState('30D');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchData() {
    console.log('[SUPABASE FETCH] [Dashboard] Querying transactions & projects tables...');
    try {
      const { data: txs, error: txsError } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });
      if (txsError) throw txsError;

      const { data: projs, error: projsError } = await supabase
        .from('projects')
        .select('*')
        .order('name', { ascending: true });
      if (projsError) throw projsError;

      console.log(`[SUPABASE FETCH SUCCESS] Loaded ${txs?.length || 0} transactions and ${projs?.length || 0} projects`);
      setTransactions(txs || []);
      setProjects(projs || []);
    } catch (err: any) {
      console.error('[SUPABASE FETCH ERROR] Dashboard data error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      console.log('[NAVIGATION FOCUS] User opened HOME (Dashboard) screen');
      fetchData();
    }, [])
  );

  useEffect(() => {
    const unsubscribe = subscribeToRealtimeChanges(() => {
      console.log('[REALTIME UPDATE] Realtime database payload received. Refreshing Dashboard...');
      fetchData();
    });
    return () => unsubscribe();
  }, []);

  const onRefresh = useCallback(() => {
    console.log('[BACKGROUND PROCESS] User pulled to refresh Dashboard data...');
    setRefreshing(true);
    fetchData();
  }, []);

  // Filter transactions by timeframe
  const getFilteredTransactions = () => {
    const now = new Date();
    if (timeFilter === '7D') {
      const limit = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      return transactions.filter(t => new Date(t.date) >= limit);
    }
    if (timeFilter === '30D') {
      const limit = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
      return transactions.filter(t => new Date(t.date) >= limit);
    }
    if (timeFilter === '3M') {
      const limit = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      return transactions.filter(t => new Date(t.date) >= limit);
    }
    if (timeFilter === '6M') {
      const limit = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      return transactions.filter(t => new Date(t.date) >= limit);
    }
    return transactions;
  };

  const periodTxs = getFilteredTransactions();

  // Dynamic Calculations from Database Records
  const totalRevenue = periodTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalExpenses = periodTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0);
  const memberPayouts = periodTxs.filter(t => t.category === 'Member Payout').reduce((s, t) => s + Number(t.amount || 0), 0);
  
  const pendingPayments = projects.reduce((s, p) => {
    const budgetVal = Number(p.budget || 0);
    // Find all completed income transactions linked to this project
    const collected = transactions
      .filter(t => t.project === p.name && t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    return s + Math.max(budgetVal - collected, 0);
  }, 0);

  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0';
  const currentBalance = totalRevenue - totalExpenses;

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>CONNECTING TO SUPABASE DATABASE...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7C3AED']} tintColor="#7C3AED" />
        }
      >
        {/* Top Header */}
        <View style={styles.header}>
          <BuildicyLogo size="medium" />
          <View style={styles.headerRight}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>REALTIME</Text>
          </View>
        </View>

        {/* Hero Current Balance Card - Royal Purple & Obsidian */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>CURRENT BALANCE</Text>
          <Text style={styles.balanceAmount}>{formatFullCurrency(currentBalance)}</Text>
          <View style={styles.balanceRow}>
            <View style={styles.balanceStat}>
              <Ionicons name="arrow-up-circle" size={16} color="#10B981" />
              <Text style={[styles.balanceStatText, { color: '#10B981' }]}>{formatCurrency(totalRevenue)} IN</Text>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceStat}>
              <Ionicons name="arrow-down-circle" size={16} color="#EF4444" />
              <Text style={[styles.balanceStatText, { color: '#EF4444' }]}>{formatCurrency(totalExpenses)} OUT</Text>
            </View>
          </View>
        </View>

        {/* KPI Brutalist Grid */}
        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, { borderColor: COLORS.green }]}>
            <Text style={styles.kpiLabel}>NET PROFIT</Text>
            <Text style={[styles.kpiValue, { color: COLORS.green }]}>{formatCurrency(netProfit)}</Text>
            <Text style={styles.kpiSub}>MARGIN {profitMargin}%</Text>
          </View>
          <View style={[styles.kpiCard, { borderColor: COLORS.yellow }]}>
            <Text style={styles.kpiLabel}>PENDING</Text>
            <Text style={[styles.kpiValue, { color: COLORS.yellow }]}>{formatCurrency(pendingPayments)}</Text>
            <Text style={styles.kpiSub}>UNCOLLECTED</Text>
          </View>
          <View style={[styles.kpiCard, { borderColor: COLORS.purple }]}>
            <Text style={styles.kpiLabel}>PAYOUTS</Text>
            <Text style={[styles.kpiValue, { color: COLORS.purple }]}>{formatCurrency(memberPayouts)}</Text>
            <Text style={styles.kpiSub}>TO MEMBERS</Text>
          </View>
          <View style={[styles.kpiCard, { borderColor: COLORS.blue }]}>
            <Text style={styles.kpiLabel}>REVENUE</Text>
            <Text style={[styles.kpiValue, { color: COLORS.blue }]}>{formatCurrency(totalRevenue)}</Text>
            <Text style={styles.kpiSub}>{timeFilter} TOTAL</Text>
          </View>
        </View>

        {/* Interactive SVG Financial Trading Chart */}
        <View style={{ marginHorizontal: 16 }}>
          <InteractiveFinanceChart
            transactions={transactions}
            timeFilter={timeFilter}
            onTimeFilterChange={setTimeFilter}
            onAddTransactionPress={() => router.push('/transactions')}
          />
        </View>

        {/* Active Projects Health */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>ACTIVE PROJECTS HEALTH</Text>
            <TouchableOpacity onPress={() => router.push('/projects')}>
              <Text style={styles.seeAll}>PROJECTS HUB →</Text>
            </TouchableOpacity>
          </View>

          {projects.filter(p => p.status === 'active').length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="briefcase-outline" size={24} color={COLORS.muted} />
              <Text style={styles.emptyCardText}>NO ACTIVE PROJECTS RECORDED</Text>
              <TouchableOpacity style={styles.emptyCardBtn} onPress={() => router.push('/projects')}>
                <Text style={styles.emptyCardBtnText}>+ CREATE PROJECT</Text>
              </TouchableOpacity>
            </View>
          ) : (
            projects.filter(p => p.status === 'active').map(project => {
              // Calculate revenue & expenses specifically linked to this project
              const projRev = transactions
                .filter(t => t.project === project.name && t.type === 'income')
                .reduce((s, t) => s + Number(t.amount || 0), 0);

              const projExp = transactions
                .filter(t => t.project === project.name && t.type === 'expense')
                .reduce((s, t) => s + Number(t.amount || 0), 0);

              const projProfit = projRev - projExp;
              const targetBudget = Number(project.budget || 0);
              const progressPct = targetBudget > 0 ? Math.min((projRev / targetBudget) * 100, 100) : 0;

              return (
                <View key={project.id} style={styles.projectRow}>
                  <View style={styles.projectInfo}>
                    <Text style={styles.projectName}>{project.name}</Text>
                    <Text style={styles.projectClient}>{project.client}</Text>
                  </View>
                  <View style={styles.projectStats}>
                    <Text style={[styles.projectMargin, { color: projProfit >= 0 ? COLORS.green : COLORS.red }]}>
                      {formatCurrency(projProfit)}
                    </Text>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${progressPct}%` as any }]} />
                    </View>
                    <Text style={styles.projectPaid}>
                      COLLECTED: {formatCurrency(projRev)} / {formatCurrency(targetBudget)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Recent Transactions List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>RECENT TRANSACTIONS</Text>
            <TouchableOpacity onPress={() => router.push('/transactions')}>
              <Text style={styles.seeAll}>VIEW ALL →</Text>
            </TouchableOpacity>
          </View>

          {transactions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="swap-vertical-outline" size={24} color={COLORS.muted} />
              <Text style={styles.emptyCardText}>NO TRANSACTIONS IN DATABASE</Text>
              <TouchableOpacity style={styles.emptyCardBtn} onPress={() => router.push('/transactions')}>
                <Text style={styles.emptyCardBtnText}>+ ADD FIRST TRANSACTION</Text>
              </TouchableOpacity>
            </View>
          ) : (
            transactions.slice(0, 5).map(tx => (
              <View key={tx.id} style={styles.txRow}>
                <View style={[styles.txIcon, { backgroundColor: tx.type === 'income' ? COLORS.green + '22' : COLORS.red + '22' }]}>
                  <Ionicons
                    name={tx.type === 'income' ? 'arrow-down-outline' : 'arrow-up-outline'}
                    size={16}
                    color={tx.type === 'income' ? COLORS.green : COLORS.red}
                  />
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txDesc} numberOfLines={1}>{tx.description}</Text>
                  <Text style={styles.txMeta}>{tx.category} · {tx.date}</Text>
                </View>
                <Text style={[styles.txAmount, { color: tx.type === 'income' ? COLORS.green : COLORS.red }]}>
                  {tx.type === 'income' ? '+' : '-'}{formatCurrency(Number(tx.amount))}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg },
  loadingText: { marginTop: 12, fontSize: 10, fontWeight: '900', color: COLORS.text, letterSpacing: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  brandTag: { fontSize: 10, fontWeight: '900', color: COLORS.yellow, letterSpacing: 4 },
  headerTitle: { fontSize: 38, fontWeight: '900', color: COLORS.text, letterSpacing: -1, lineHeight: 40 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 2, borderColor: '#7C3AED', backgroundColor: '#0B0F17', paddingHorizontal: 10, paddingVertical: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.green },
  liveText: { fontSize: 9, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1.5 },
  
  balanceCard: { marginHorizontal: 16, marginBottom: 16, backgroundColor: '#0B0F17', padding: 20, borderWidth: 2, borderColor: '#7C3AED', shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 6 },
  balanceLabel: { fontSize: 10, fontWeight: '900', color: '#A855F7', letterSpacing: 3, marginBottom: 4 },
  balanceAmount: { fontSize: 42, fontWeight: '900', color: '#FFFFFF', letterSpacing: -2, marginBottom: 12 },
  balanceRow: { flexDirection: 'row', alignItems: 'center' },
  balanceStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  balanceStatText: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },
  balanceDivider: { width: 2, height: 14, backgroundColor: '#7C3AED', marginHorizontal: 14 },
  
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  kpiCard: { width: (width - 40) / 2, backgroundColor: COLORS.card, borderWidth: 2, padding: 14 },
  kpiLabel: { fontSize: 9, fontWeight: '900', color: COLORS.muted, letterSpacing: 2, marginBottom: 6 },
  kpiValue: { fontSize: 24, fontWeight: '900', letterSpacing: -1, marginBottom: 2 },
  kpiSub: { fontSize: 9, fontWeight: '800', color: COLORS.muted, letterSpacing: 1 },
  
  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '900', color: COLORS.text, letterSpacing: 2 },
  seeAll: { fontSize: 10, fontWeight: '900', color: COLORS.yellow, letterSpacing: 1 },
  
  emptyCard: { backgroundColor: COLORS.card, borderWidth: 2, borderColor: COLORS.border, padding: 20, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyCardText: { fontSize: 10, fontWeight: '900', color: COLORS.muted, letterSpacing: 1 },
  emptyCardBtn: { backgroundColor: COLORS.yellow, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 2, borderColor: COLORS.border, marginTop: 4 },
  emptyCardBtnText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  
  projectRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: COLORS.card, borderWidth: 2, borderColor: COLORS.border, padding: 12, marginBottom: 8 },
  projectInfo: { flex: 1, marginRight: 12 },
  projectName: { fontSize: 14, fontWeight: '900', color: COLORS.text, marginBottom: 2 },
  projectClient: { fontSize: 11, color: COLORS.muted, fontWeight: '700' },
  projectStats: { alignItems: 'flex-end' },
  projectMargin: { fontSize: 18, fontWeight: '900', marginBottom: 4 },
  progressBar: { width: 100, height: 4, backgroundColor: COLORS.dim, marginBottom: 4 },
  progressFill: { height: 4, backgroundColor: COLORS.green },
  projectPaid: { fontSize: 9, color: COLORS.muted, fontWeight: '800' },
  
  txRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderWidth: 2, borderColor: COLORS.border, padding: 12, marginBottom: 6, gap: 12 },
  txIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  txInfo: { flex: 1 },
  txDesc: { fontSize: 13, fontWeight: '800', color: COLORS.text, marginBottom: 2 },
  txMeta: { fontSize: 10, color: COLORS.muted, fontWeight: '700' },
  txAmount: { fontSize: 14, fontWeight: '900' },
});
