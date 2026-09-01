import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { COLORS, formatCurrency, Project, Transaction } from '../data/demo';
import { supabase, subscribeToRealtimeChanges } from '../lib/supabase';

import { BuildicyLogo } from '../components/BuildicyLogo';

const STATUS_FILTERS = ['ALL', 'ACTIVE', 'COMPLETED', 'PAUSED'];

export default function Projects() {
  const [filter, setFilter] = useState('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [status, setStatus] = useState<'active' | 'completed' | 'paused'>('active');
  const [budget, setBudget] = useState('');
  const [category, setCategory] = useState('Development');

  async function fetchProjectsData() {
    console.log('[SUPABASE FETCH] [Projects] Querying projects, transactions & clients tables...');
    try {
      const { data: projs, error: pErr } = await supabase
        .from('projects')
        .select('*')
        .order('name', { ascending: true });
      if (pErr) throw pErr;

      const { data: txs, error: tErr } = await supabase
        .from('transactions')
        .select('*');
      if (tErr) throw tErr;

      const { data: clients, error: cErr } = await supabase
        .from('clients')
        .select('company, name');
      if (cErr) throw cErr;

      console.log(`[SUPABASE FETCH SUCCESS] Loaded ${projs?.length || 0} projects and ${txs?.length || 0} transactions`);
      setProjects(projs || []);
      setTransactions(txs || []);
      setClientsList(clients || []);
    } catch (err: any) {
      console.error('[SUPABASE FETCH ERROR] Projects fetch error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      console.log('[NAVIGATION FOCUS] User opened PROJECTS screen');
      fetchProjectsData();
    }, [])
  );

  useEffect(() => {
    const unsubscribe = subscribeToRealtimeChanges(() => {
      console.log('[REALTIME UPDATE] Projects or transactions DB updated. Refreshing Projects...');
      fetchProjectsData();
    });
    return () => unsubscribe();
  }, []);

  const onRefresh = useCallback(() => {
    console.log('[BACKGROUND PROCESS] User refreshed Projects screen');
    setRefreshing(true);
    fetchProjectsData();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setClient('');
    setStatus('active');
    setBudget('');
    setCategory('Development');
  };

  const openCreateModal = () => {
    resetForm();
    if (clientsList.length > 0) {
      setClient(clientsList[0].company || clientsList[0].name);
    }
    setIsModalOpen(true);
  };

  const openEditModal = (p: Project) => {
    setEditingId(p.id);
    setName(p.name);
    setClient(p.client);
    setStatus(p.status);
    setBudget(p.budget ? p.budget.toString() : '');
    setCategory(p.category || 'Development');
    setIsModalOpen(true);
  };

  async function handleSaveProject() {
    if (!name || !client) {
      Alert.alert('Error', 'Please enter project name and client');
      return;
    }

    const budgetNum = budget ? parseFloat(budget) : 0;
    const payload = {
      name: name.trim(),
      client: client.trim(),
      status,
      budget: isNaN(budgetNum) ? 0 : budgetNum,
      category,
    };

    try {
      if (editingId) {
        console.log(`[SUPABASE UPDATE] Updating project ID: ${editingId}...`);
        const { error } = await supabase.from('projects').update(payload).eq('id', editingId);
        if (error) throw error;
        Alert.alert('Success', 'Project updated!');
      } else {
        console.log(`[SUPABASE INSERT] Saving new project: ${name}...`);
        const { error } = await supabase.from('projects').insert(payload);
        if (error) throw error;
        Alert.alert('Success', 'Project created!');
      }

      setIsModalOpen(false);
      resetForm();
      fetchProjectsData();
    } catch (err: any) {
      console.error('[SUPABASE PROJECT SAVE ERROR]', err.message || err);
      Alert.alert('Error', err.message || 'Failed to save project');
    }
  }

  async function handleDeleteProject() {
    if (!editingId) return;

    Alert.alert(
      'Delete Project',
      'Are you sure you want to delete this project? Associated transactions will remain recorded.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log(`[SUPABASE DELETE] Deleting project ID: ${editingId}...`);
              const { error } = await supabase.from('projects').delete().eq('id', editingId);
              if (error) throw error;

              Alert.alert('Deleted', 'Project removed.');
              setIsModalOpen(false);
              resetForm();
              fetchProjectsData();
            } catch (err: any) {
              console.error('[SUPABASE DELETE PROJECT ERROR]', err.message || err);
              Alert.alert('Error', err.message || 'Failed to delete project');
            }
          },
        },
      ]
    );
  }

  const filteredProjects = projects.filter(p => {
    if (filter === 'ACTIVE') return p.status === 'active';
    if (filter === 'COMPLETED') return p.status === 'completed';
    if (filter === 'PAUSED') return p.status === 'paused';
    return true;
  });

  // Dynamic calculations across all projects
  const computedProjects = filteredProjects.map(p => {
    const projTxs = transactions.filter(t => t.project === p.name);
    const revenue = projTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
    const expenses = projTxs.filter(t => t.type === 'expense' && t.category !== 'Member Payout').reduce((s, t) => s + Number(t.amount || 0), 0);
    const memberPayouts = projTxs.filter(t => t.type === 'expense' && t.category === 'Member Payout').reduce((s, t) => s + Number(t.amount || 0), 0);
    const collected = projTxs.filter(t => t.type === 'income' && t.payment_status !== 'pending').reduce((s, t) => s + Number(t.amount || 0), 0);
    const targetBudget = Number(p.budget || 0);
    const pending = Math.max(targetBudget - collected, 0);
    const profit = revenue - (expenses + memberPayouts);
    const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0.0';

    return {
      ...p,
      revenue,
      expenses,
      memberPayouts,
      collected,
      pending,
      profit,
      margin,
    };
  });

  const totalRevenueAll = computedProjects.reduce((s, p) => s + p.revenue, 0);
  const totalProfitAll = computedProjects.reduce((s, p) => s + p.profit, 0);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>LOADING PROJECTS...</Text>
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
        {/* Top Header */}
        <View style={styles.header}>
          <BuildicyLogo size="small" showSubtitle={false} />
          <TouchableOpacity style={styles.addButton} onPress={openCreateModal} activeOpacity={0.8}>
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Global Summary Box */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>TOTAL REVENUE</Text>
            <Text style={[styles.statValue, { color: COLORS.blue }]}>{formatCurrency(totalRevenueAll)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>NET PROFIT</Text>
            <Text style={[styles.statValue, { color: totalProfitAll >= 0 ? COLORS.green : COLORS.red }]}>
              {formatCurrency(totalProfitAll)}
            </Text>
          </View>
        </View>

        {/* Status Filters */}
        <View style={styles.filterRow}>
          {STATUS_FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && styles.activeFilterChip]}
              onPress={() => setFilter(f)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterChipText, filter === f && styles.activeFilterChipText]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Projects List / Zero State */}
        <View style={styles.listContainer}>
          {computedProjects.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="briefcase-outline" size={32} color={COLORS.muted} />
              <Text style={styles.emptyTitle}>NO PROJECTS FOUND</Text>
              <Text style={styles.emptySub}>
                {filter !== 'ALL' ? `No ${filter.toLowerCase()} projects present.` : 'Create a project to link transactions, track revenue, and monitor payouts.'}
              </Text>
              <TouchableOpacity style={styles.emptyAddBtn} onPress={openCreateModal} activeOpacity={0.8}>
                <Text style={styles.emptyAddBtnText}>+ CREATE PROJECT</Text>
              </TouchableOpacity>
            </View>
          ) : (
            computedProjects.map(p => {
              const isExpanded = expandedId === p.id;
              return (
                <View key={p.id} style={styles.projectCard}>
                  {/* Card Main Row */}
                  <TouchableOpacity
                    style={styles.cardHeader}
                    onPress={() => setExpandedId(isExpanded ? null : p.id)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Text style={styles.projectName}>{p.name}</Text>
                        <View style={[styles.statusTag, { backgroundColor: p.status === 'active' ? COLORS.green : p.status === 'completed' ? COLORS.blue : COLORS.muted }]}>
                          <Text style={styles.statusTagText}>{p.status.toUpperCase()}</Text>
                        </View>
                      </View>
                      <Text style={styles.projectClient}>CLIENT: {p.client}</Text>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.projectProfit, { color: p.profit >= 0 ? COLORS.green : COLORS.red }]}>
                        {formatCurrency(p.profit)}
                      </Text>
                      <Text style={styles.projectMargin}>{p.margin}% PROFIT MARGIN</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Expanded Metrics Section */}
                  {isExpanded && (
                    <View style={styles.expandedContent}>
                      <View style={styles.gridRow}>
                        <View style={styles.gridCell}>
                          <Text style={styles.cellLabel}>TARGET BUDGET</Text>
                          <Text style={styles.cellVal}>{formatCurrency(Number(p.budget || 0))}</Text>
                        </View>
                        <View style={styles.gridCell}>
                          <Text style={styles.cellLabel}>RECORDED REVENUE</Text>
                          <Text style={[styles.cellVal, { color: COLORS.green }]}>{formatCurrency(p.revenue)}</Text>
                        </View>
                      </View>

                      <View style={styles.gridRow}>
                        <View style={styles.gridCell}>
                          <Text style={styles.cellLabel}>DIRECT EXPENSES</Text>
                          <Text style={[styles.cellVal, { color: COLORS.red }]}>{formatCurrency(p.expenses)}</Text>
                        </View>
                        <View style={styles.gridCell}>
                          <Text style={styles.cellLabel}>MEMBER PAYOUTS</Text>
                          <Text style={[styles.cellVal, { color: COLORS.purple }]}>{formatCurrency(p.memberPayouts)}</Text>
                        </View>
                      </View>

                      <View style={styles.cardActions}>
                        <TouchableOpacity
                          style={styles.editCardBtn}
                          onPress={() => openEditModal(p)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="pencil" size={14} color={COLORS.text} />
                          <Text style={styles.editCardBtnText}>EDIT PROJECT</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Create / Edit Project Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalOpen}
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? 'EDIT PROJECT' : 'CREATE NEW PROJECT'}</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalForm} showsVerticalScrollIndicator={false}>
              {/* Project Name */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>PROJECT NAME</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Mobile App Dev"
                  placeholderTextColor="#9CA3AF"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              {/* Client Selector or Input */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>CLIENT NAME / COMPANY</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Apex Tech"
                  placeholderTextColor="#9CA3AF"
                  value={client}
                  onChangeText={setClient}
                />
                {clientsList.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {clientsList.map(c => (
                        <TouchableOpacity
                          key={c.company || c.name}
                          style={[styles.chip, client === (c.company || c.name) && styles.chipActive]}
                          onPress={() => setClient(c.company || c.name)}
                        >
                          <Text style={[styles.chipText, client === (c.company || c.name) && { color: '#FFFFFF' }]}>
                            {c.company || c.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                )}
              </View>

              {/* Budget */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>TARGET BUDGET (INR)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. 300000"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  value={budget}
                  onChangeText={setBudget}
                />
              </View>

              {/* Status */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>PROJECT STATUS</Text>
                <View style={styles.statusRow}>
                  {(['active', 'completed', 'paused'] as const).map(st => (
                    <TouchableOpacity
                      key={st}
                      style={[styles.statusBtn, status === st && styles.statusBtnActive]}
                      onPress={() => setStatus(st)}
                    >
                      <Text style={[styles.statusBtnText, status === st && { color: '#FFFFFF' }]}>
                        {st.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Category */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>CATEGORY</Text>
                <View style={styles.statusRow}>
                  {['Development', 'Design', 'UI/UX', 'Consulting'].map(cat => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.chip, category === cat && styles.chipActive]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text style={[styles.chipText, category === cat && { color: '#FFFFFF' }]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProject} activeOpacity={0.8}>
                <Text style={styles.saveBtnText}>{editingId ? 'UPDATE PROJECT' : 'CREATE PROJECT'}</Text>
              </TouchableOpacity>

              {editingId && (
                <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteProject} activeOpacity={0.8}>
                  <Text style={styles.deleteBtnText}>DELETE PROJECT</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadingText: { marginTop: 12, fontSize: 10, fontWeight: '900', color: COLORS.text, letterSpacing: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: COLORS.text, letterSpacing: -1 },
  subtitle: { fontSize: 9, fontWeight: '900', color: COLORS.muted, letterSpacing: 1.5 },
  addButton: { width: 44, height: 44, backgroundColor: COLORS.yellow, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.border },
  
  statsRow: { flexDirection: 'row', backgroundColor: COLORS.card, marginHorizontal: 16, marginBottom: 12, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 2, borderColor: COLORS.border, justifyContent: 'space-around', alignItems: 'center' },
  statBox: { alignItems: 'center' },
  statLabel: { fontSize: 8, fontWeight: '900', color: COLORS.muted, letterSpacing: 1, marginBottom: 2 },
  statValue: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  statDivider: { width: 1.5, height: 24, backgroundColor: COLORS.border },
  
  filterRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginBottom: 12 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 2, borderColor: COLORS.border, backgroundColor: COLORS.card },
  activeFilterChip: { backgroundColor: COLORS.border },
  filterChipText: { fontSize: 10, fontWeight: '900', color: COLORS.text, letterSpacing: 1 },
  activeFilterChipText: { color: '#FFFFFF' },
  
  listContainer: { paddingHorizontal: 16 },
  projectCard: { backgroundColor: COLORS.card, borderWidth: 2, borderColor: COLORS.border, marginBottom: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 14 },
  projectName: { fontSize: 15, fontWeight: '900', color: COLORS.text },
  projectClient: { fontSize: 10, fontWeight: '800', color: COLORS.muted },
  projectProfit: { fontSize: 16, fontWeight: '900', letterSpacing: -0.5 },
  projectMargin: { fontSize: 8, fontWeight: '900', color: COLORS.muted, letterSpacing: 0.5, marginTop: 2 },
  statusTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 0 },
  statusTagText: { fontSize: 8, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5 },
  
  expandedContent: { padding: 14, paddingTop: 0, borderTopWidth: 1, borderTopColor: '#E5E7EB', gap: 10 },
  gridRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  gridCell: { flex: 1, backgroundColor: '#F8F9FA', padding: 8, borderWidth: 1, borderColor: COLORS.border },
  cellLabel: { fontSize: 8, fontWeight: '900', color: COLORS.muted, letterSpacing: 1, marginBottom: 2 },
  cellVal: { fontSize: 13, fontWeight: '900' },
  cardActions: { marginTop: 4 },
  editCardBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, borderWidth: 2, borderColor: COLORS.border, backgroundColor: '#F3F4F6' },
  editCardBtnText: { fontSize: 10, fontWeight: '900', color: COLORS.text, letterSpacing: 1 },
  
  emptyCard: { backgroundColor: COLORS.card, borderWidth: 2, borderColor: COLORS.border, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 },
  emptyTitle: { fontSize: 12, fontWeight: '900', color: COLORS.text, letterSpacing: 1 },
  emptySub: { fontSize: 11, fontWeight: '700', color: COLORS.muted, textAlign: 'center' },
  emptyAddBtn: { backgroundColor: COLORS.yellow, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 2, borderColor: COLORS.border, marginTop: 8 },
  emptyAddBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.card, borderWidth: 2, borderColor: COLORS.border, maxHeight: '90%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 16, fontWeight: '900', color: COLORS.text, letterSpacing: 1 },
  modalForm: { gap: 14 },
  formGroup: { gap: 6 },
  formLabel: { fontSize: 9, fontWeight: '900', color: COLORS.muted, letterSpacing: 1.5 },
  formInput: { height: 44, borderWidth: 2, borderColor: COLORS.border, paddingHorizontal: 12, fontSize: 13, fontWeight: '700', color: COLORS.text, backgroundColor: '#FFFFFF' },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusBtn: { flex: 1, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.border, backgroundColor: '#F3F4F6' },
  statusBtnActive: { backgroundColor: COLORS.border },
  statusBtnText: { fontSize: 10, fontWeight: '900', color: COLORS.text, letterSpacing: 1 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#F3F4F6' },
  chipActive: { backgroundColor: COLORS.border },
  chipText: { fontSize: 10, fontWeight: '800', color: COLORS.text },
  saveBtn: { height: 48, backgroundColor: COLORS.yellow, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.border, marginTop: 10 },
  saveBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  deleteBtn: { height: 44, backgroundColor: COLORS.red, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.border },
  deleteBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
});
