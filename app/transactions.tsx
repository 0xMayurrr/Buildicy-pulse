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
import { COLORS, formatCurrency, Transaction } from '../data/demo';
import { supabase, subscribeToRealtimeChanges } from '../lib/supabase';

import { BuildicyLogo } from '../components/BuildicyLogo';

const CATEGORIES = ['ALL', 'INCOME', 'EXPENSE', 'PROJECT', 'PAYOUT', 'SOFTWARE'];

export default function Transactions() {
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Project Revenue');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'completed' | 'pending'>('completed');
  const [notes, setNotes] = useState('');

  // Dropdown options from DB
  const [dbProjects, setDbProjects] = useState<any[]>([]);
  const [dbMembers, setDbMembers] = useState<any[]>([]);
  const [dbClients, setDbClients] = useState<any[]>([]);

  const incomeCategories = ['Project Revenue', 'Retainer', 'Operations', 'Refund', 'Other'];
  const expenseCategories = ['Member Payout', 'Software', 'Marketing', 'Hosting', 'Operations', 'Other'];

  async function fetchTransactions() {
    console.log('[SUPABASE FETCH] [Transactions] Querying transactions table...');
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw error;
      console.log(`[SUPABASE FETCH SUCCESS] Loaded ${data?.length || 0} transaction records`);
      setTransactions(data || []);
    } catch (err: any) {
      console.error('[SUPABASE FETCH ERROR] Transactions fetch error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function fetchDropdownData() {
    console.log('[SUPABASE FETCH] [Transactions] Querying dropdown options (projects, members, clients)...');
    try {
      const { data: p } = await supabase.from('projects').select('name');
      const { data: m } = await supabase.from('members').select('name');
      const { data: c } = await supabase.from('clients').select('company, name');
      setDbProjects(p || []);
      setDbMembers(m || []);
      setDbClients(c || []);
    } catch (e) {
      console.log('[SUPABASE FETCH ERROR] Dropdown options error:', e);
    }
  }

  useFocusEffect(
    useCallback(() => {
      console.log('[NAVIGATION FOCUS] User opened TRANSACTIONS screen');
      fetchTransactions();
      fetchDropdownData();
    }, [])
  );

  useEffect(() => {
    const unsubscribe = subscribeToRealtimeChanges(() => {
      console.log('[REALTIME UPDATE] Transactions DB updated. Refetching list...');
      fetchTransactions();
    });
    return () => unsubscribe();
  }, []);

  const onRefresh = useCallback(() => {
    console.log('[BACKGROUND PROCESS] User refreshed Transactions list');
    setRefreshing(true);
    fetchTransactions();
    fetchDropdownData();
  }, []);

  // Form helpers
  const handleTypeChange = (newType: 'income' | 'expense') => {
    setType(newType);
    setCategory(newType === 'income' ? incomeCategories[0] : expenseCategories[0]);
  };

  const resetForm = () => {
    setEditingId(null);
    setType('income');
    setDescription('');
    setAmount('');
    setCategory('Project Revenue');
    setDate(new Date().toISOString().split('T')[0]);
    setSelectedClient(null);
    setSelectedProject(null);
    setSelectedMember(null);
    setPaymentStatus('completed');
    setNotes('');
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (tx: Transaction) => {
    setEditingId(tx.id);
    setType(tx.type);
    setDescription(tx.description);
    setAmount(tx.amount.toString());
    setCategory(tx.category);
    setDate(tx.date);
    setSelectedClient(tx.client || null);
    setSelectedProject(tx.project || null);
    setSelectedMember(tx.member || null);
    setPaymentStatus(tx.payment_status || 'completed');
    setNotes(tx.notes || '');
    setIsModalOpen(true);
  };

  async function handleSaveTransaction() {
    if (!description || !amount) {
      Alert.alert('Error', 'Please fill in description and amount');
      return;
    }
    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      Alert.alert('Error', 'Please enter a valid positive amount');
      return;
    }

    const payload = {
      type,
      description,
      amount: amtNum,
      category,
      date,
      client: selectedClient || null,
      project: selectedProject || null,
      member: selectedMember || null,
      payment_status: paymentStatus,
      notes: notes || null,
    };

    try {
      if (editingId) {
        console.log(`[SUPABASE UPDATE] Updating transaction ID: ${editingId}...`);
        const { error } = await supabase.from('transactions').update(payload).eq('id', editingId);
        if (error) throw error;
        Alert.alert('Success', 'Transaction updated!');
      } else {
        console.log(`[SUPABASE INSERT] Saving new ${type} transaction...`);
        const { error } = await supabase.from('transactions').insert(payload);
        if (error) throw error;
        Alert.alert('Success', 'Transaction recorded!');
      }

      setIsModalOpen(false);
      resetForm();
      fetchTransactions();
    } catch (err: any) {
      console.error('[SUPABASE ERROR]', err.message || err);
      Alert.alert('Error', err.message || 'Failed to save transaction');
    }
  }

  async function handleDeleteTransaction() {
    if (!editingId) return;

    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to permanently delete this transaction record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log(`[SUPABASE DELETE] Deleting transaction ID: ${editingId}...`);
              const { error } = await supabase.from('transactions').delete().eq('id', editingId);
              if (error) throw error;

              Alert.alert('Deleted', 'Transaction removed.');
              setIsModalOpen(false);
              resetForm();
              fetchTransactions();
            } catch (err: any) {
              console.error('[SUPABASE DELETE ERROR]', err.message || err);
              Alert.alert('Error', err.message || 'Failed to delete transaction');
            }
          },
        },
      ]
    );
  }

  // Filtering
  const filtered = transactions.filter(tx => {
    if (filter === 'INCOME') return tx.type === 'income';
    if (filter === 'EXPENSE') return tx.type === 'expense';
    if (filter === 'PROJECT') return tx.category === 'Project Revenue';
    if (filter === 'PAYOUT') return tx.category === 'Member Payout';
    if (filter === 'SOFTWARE') return tx.category === 'Software';
    return true;
  }).filter(tx =>
    search === '' || tx.description.toLowerCase().includes(search.toLowerCase())
  );

  const totalIn = filtered.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>LOADING TRANSACTIONS...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <BuildicyLogo size="small" showSubtitle={false} />
        <TouchableOpacity style={styles.addButton} onPress={openCreateModal} activeOpacity={0.8}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Summary Bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>TOTAL IN</Text>
          <Text style={[styles.summaryValue, { color: COLORS.green }]}>{formatCurrency(totalIn)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>TOTAL OUT</Text>
          <Text style={[styles.summaryValue, { color: COLORS.red }]}>{formatCurrency(totalOut)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>NET CASH</Text>
          <Text style={[styles.summaryValue, { color: totalIn - totalOut >= 0 ? COLORS.green : COLORS.red }]}>
            {formatCurrency(totalIn - totalOut)}
          </Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={COLORS.text} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search transactions by description..."
          placeholderTextColor="#6B7280"
          value={search}
          onChangeText={setSearch}
          selectionColor="#7C3AED"
        />
      </View>

      {/* Category Filter Tabs */}
      <View style={{ height: 42, marginBottom: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <View style={styles.filterRow}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.filterBtn, filter === cat && styles.filterBtnActive]}
                onPress={() => setFilter(cat)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterText, filter === cat && styles.filterTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* List / Zero State */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7C3AED']} tintColor="#7C3AED" />
        }
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="swap-vertical-outline" size={32} color={COLORS.muted} />
            <Text style={styles.emptyTitle}>NO TRANSACTIONS FOUND</Text>
            <Text style={styles.emptySub}>
              {search ? 'Try clearing your search query' : 'Tap + to record your first transaction.'}
            </Text>
            <TouchableOpacity style={styles.emptyAddBtn} onPress={openCreateModal} activeOpacity={0.8}>
              <Text style={styles.emptyAddBtnText}>+ RECORD TRANSACTION</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filtered.map(tx => (
            <TouchableOpacity
              key={tx.id}
              style={styles.txCard}
              activeOpacity={0.8}
              onPress={() => openEditModal(tx)}
            >
              <View style={styles.txTop}>
                <View style={styles.txLeft}>
                  <View style={[styles.txIndicator, { backgroundColor: tx.type === 'income' ? COLORS.green : COLORS.red }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txDesc}>{tx.description}</Text>
                    <Text style={styles.txCategory}>{tx.category.toUpperCase()}</Text>
                  </View>
                </View>
                <View style={styles.txRight}>
                  <Text style={[styles.txAmount, { color: tx.type === 'income' ? COLORS.green : COLORS.red }]}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(Number(tx.amount))}
                  </Text>
                  <Text style={styles.txDate}>{tx.date}</Text>
                </View>
              </View>

              {(tx.client || tx.member || tx.project) && (
                <View style={styles.txMetaRow}>
                  {tx.client && <Text style={styles.txMetaTag}>CLIENT: {tx.client}</Text>}
                  {tx.project && <Text style={styles.txMetaTag}>PROJECT: {tx.project}</Text>}
                  {tx.member && <Text style={styles.txMetaTag}>MEMBER: {tx.member}</Text>}
                </View>
              )}
              {tx.notes && <Text style={styles.txNotes}>{tx.notes}</Text>}
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Modal: Create & Edit Transaction */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalOpen}
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? 'EDIT TRANSACTION' : 'NEW TRANSACTION'}</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalForm} showsVerticalScrollIndicator={false}>
              {/* Type Switcher */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>TRANSACTION TYPE</Text>
                <View style={styles.typeContainer}>
                  <TouchableOpacity
                    style={[styles.typeBtn, type === 'income' && styles.typeBtnActiveIncome]}
                    onPress={() => handleTypeChange('income')}
                  >
                    <Text style={[styles.typeBtnText, type === 'income' && { color: '#FFFFFF' }]}>INCOME</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.typeBtn, type === 'expense' && styles.typeBtnActiveExpense]}
                    onPress={() => handleTypeChange('expense')}
                  >
                    <Text style={[styles.typeBtnText, type === 'expense' && { color: '#FFFFFF' }]}>EXPENSE</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Description */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>DESCRIPTION</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Mobile App Dev Milestone 1"
                  placeholderTextColor="#9CA3AF"
                  value={description}
                  onChangeText={setDescription}
                />
              </View>

              {/* Amount */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>AMOUNT (INR)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. 50000"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                />
              </View>

              {/* Date */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>DATE (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9CA3AF"
                  value={date}
                  onChangeText={setDate}
                />
              </View>

              {/* Category */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>CATEGORY</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {(type === 'income' ? incomeCategories : expenseCategories).map(cat => (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.catChip, category === cat && styles.catChipActive]}
                        onPress={() => setCategory(cat)}
                      >
                        <Text style={[styles.catChipText, category === cat && { color: '#FFFFFF' }]}>{cat}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* Link Project */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>LINK TO PROJECT (OPTIONAL)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      style={[styles.catChip, selectedProject === null && styles.catChipActive]}
                      onPress={() => setSelectedProject(null)}
                    >
                      <Text style={[styles.catChipText, selectedProject === null && { color: '#FFFFFF' }]}>NONE</Text>
                    </TouchableOpacity>
                    {dbProjects.map(p => (
                      <TouchableOpacity
                        key={p.name}
                        style={[styles.catChip, selectedProject === p.name && styles.catChipActive]}
                        onPress={() => setSelectedProject(p.name)}
                      >
                        <Text style={[styles.catChipText, selectedProject === p.name && { color: '#FFFFFF' }]}>{p.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* Link Member */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>LINK TO TEAM MEMBER (OPTIONAL)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      style={[styles.catChip, selectedMember === null && styles.catChipActive]}
                      onPress={() => setSelectedMember(null)}
                    >
                      <Text style={[styles.catChipText, selectedMember === null && { color: '#FFFFFF' }]}>NONE</Text>
                    </TouchableOpacity>
                    {dbMembers.map(m => (
                      <TouchableOpacity
                        key={m.name}
                        style={[styles.catChip, selectedMember === m.name && styles.catChipActive]}
                        onPress={() => setSelectedMember(m.name)}
                      >
                        <Text style={[styles.catChipText, selectedMember === m.name && { color: '#FFFFFF' }]}>{m.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* Link Client */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>LINK TO CLIENT (OPTIONAL)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      style={[styles.catChip, selectedClient === null && styles.catChipActive]}
                      onPress={() => setSelectedClient(null)}
                    >
                      <Text style={[styles.catChipText, selectedClient === null && { color: '#FFFFFF' }]}>NONE</Text>
                    </TouchableOpacity>
                    {dbClients.map(c => (
                      <TouchableOpacity
                        key={c.company || c.name}
                        style={[styles.catChip, selectedClient === (c.company || c.name) && styles.catChipActive]}
                        onPress={() => setSelectedClient(c.company || c.name)}
                      >
                        <Text style={[styles.catChipText, selectedClient === (c.company || c.name) && { color: '#FFFFFF' }]}>
                          {c.company || c.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* Notes */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>NOTES</Text>
                <TextInput
                  style={[styles.formInput, { height: 60 }]}
                  placeholder="Additional payment details..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>

              {/* Submit / Action Buttons */}
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveTransaction}
                activeOpacity={0.8}
              >
                <Text style={styles.saveBtnText}>{editingId ? 'UPDATE TRANSACTION' : 'SAVE TRANSACTION'}</Text>
              </TouchableOpacity>

              {editingId && (
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={handleDeleteTransaction}
                  activeOpacity={0.8}
                >
                  <Text style={styles.deleteBtnText}>DELETE TRANSACTION</Text>
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
  count: { fontSize: 9, fontWeight: '900', color: COLORS.muted, letterSpacing: 1.5 },
  addButton: { width: 44, height: 44, backgroundColor: COLORS.yellow, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.border },
  
  summaryBar: { flexDirection: 'row', backgroundColor: COLORS.card, marginHorizontal: 16, marginBottom: 12, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 2, borderColor: COLORS.border, justifyContent: 'space-around', alignItems: 'center' },
  summaryItem: { alignItems: 'center' },
  summaryLabel: { fontSize: 8, fontWeight: '900', color: COLORS.muted, letterSpacing: 1, marginBottom: 2 },
  summaryValue: { fontSize: 16, fontWeight: '900', letterSpacing: -0.5 },
  summaryDivider: { width: 1.5, height: 24, backgroundColor: COLORS.border },
  
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 12, height: 44, borderWidth: 2, borderColor: COLORS.border, gap: 8 },
  searchInput: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.text },
  
  filterScroll: { paddingHorizontal: 16 },
  filterRow: { flexDirection: 'row', gap: 6 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.card, borderWidth: 2, borderColor: COLORS.border },
  filterBtnActive: { backgroundColor: COLORS.border },
  filterText: { fontSize: 10, fontWeight: '900', color: COLORS.text, letterSpacing: 1 },
  filterTextActive: { color: '#FFFFFF' },
  
  list: { flex: 1, paddingHorizontal: 16 },
  txCard: { backgroundColor: COLORS.card, borderWidth: 2, borderColor: COLORS.border, padding: 14, marginBottom: 8 },
  txTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  txLeft: { flexDirection: 'row', gap: 10, flex: 1, marginRight: 10 },
  txIndicator: { width: 4, height: 36 },
  txDesc: { fontSize: 14, fontWeight: '900', color: COLORS.text, marginBottom: 2 },
  txCategory: { fontSize: 9, fontWeight: '800', color: COLORS.muted, letterSpacing: 1 },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontSize: 16, fontWeight: '900', letterSpacing: -0.5 },
  txDate: { fontSize: 10, fontWeight: '700', color: COLORS.muted, marginTop: 2 },
  
  txMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  txMetaTag: { fontSize: 9, fontWeight: '900', color: COLORS.text, backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: COLORS.border },
  txNotes: { fontSize: 10, fontWeight: '600', color: COLORS.muted, marginTop: 6, fontStyle: 'italic' },
  
  emptyCard: { backgroundColor: COLORS.card, borderWidth: 2, borderColor: COLORS.border, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 },
  emptyTitle: { fontSize: 12, fontWeight: '900', color: COLORS.text, letterSpacing: 1 },
  emptySub: { fontSize: 11, fontWeight: '700', color: COLORS.muted, textAlign: 'center' },
  emptyAddBtn: { backgroundColor: COLORS.yellow, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 2, borderColor: COLORS.border, marginTop: 8 },
  emptyAddBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.card, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderWidth: 2, borderColor: COLORS.border, maxHeight: '90%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 16, fontWeight: '900', color: COLORS.text, letterSpacing: 1 },
  modalForm: { gap: 14 },
  formGroup: { gap: 6 },
  formLabel: { fontSize: 9, fontWeight: '900', color: COLORS.muted, letterSpacing: 1.5 },
  formInput: { height: 44, borderWidth: 2, borderColor: COLORS.border, paddingHorizontal: 12, fontSize: 13, fontWeight: '700', color: COLORS.text, backgroundColor: '#FFFFFF' },
  
  typeContainer: { flexDirection: 'row', gap: 8 },
  typeBtn: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.border, backgroundColor: '#F3F4F6' },
  typeBtnActiveIncome: { backgroundColor: COLORS.green, borderColor: COLORS.border },
  typeBtnActiveExpense: { backgroundColor: COLORS.red, borderColor: COLORS.border },
  typeBtnText: { fontSize: 11, fontWeight: '900', color: COLORS.text, letterSpacing: 1 },
  
  catChip: { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#F3F4F6' },
  catChipActive: { backgroundColor: COLORS.border },
  catChipText: { fontSize: 10, fontWeight: '800', color: COLORS.text },
  
  saveBtn: { height: 48, backgroundColor: COLORS.yellow, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.border, marginTop: 10 },
  saveBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  deleteBtn: { height: 44, backgroundColor: COLORS.red, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.border },
  deleteBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
});
