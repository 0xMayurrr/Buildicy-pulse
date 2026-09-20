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
  Dimensions,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, formatCurrency, formatFullCurrency, Client, Member, Transaction, Project } from '../data/demo';
import { supabase, subscribeToRealtimeChanges } from '../lib/supabase';
import { BuildicyLogo } from '../components/BuildicyLogo';
import { generateAndShareInvoice, generateAndShareReport } from '../lib/pdfGenerator';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_COLUMNS = 4;
const GRID_ITEM_WIDTH = (SCREEN_WIDTH - 32) / GRID_COLUMNS;

export default function MoreMinimalGrid() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [userEmail, setUserEmail] = useState<string>('admin@buildicy.com');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Active Modals State
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Client Form State
  const [isClientFormOpen, setIsClientFormOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientCompany, setClientCompany] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');

  // Member Form State
  const [isMemberFormOpen, setIsMemberFormOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState('');
  const [memberAvatar, setMemberAvatar] = useState('👨‍💻');
  const [memberHourlyRate, setMemberHourlyRate] = useState('');

  // Invoice Form State
  const [invClient, setInvClient] = useState('');
  const [invProject, setInvProject] = useState('');
  const [invDesc, setInvDesc] = useState('Software Engineering Services');
  const [invAmount, setInvAmount] = useState('50000');
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Settings State
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  useEffect(() => {
    async function loadBiometricSetting() {
      try {
        const storedVal = await AsyncStorage.getItem('BUILDICY_BIOMETRIC_ENABLED');
        setBiometricEnabled(storedVal === 'true');
      } catch (e) {
        console.log('[BIOMETRIC READ ERROR]', e);
      }
    }
    loadBiometricSetting();
  }, []);

  async function handleToggleBiometric(targetVal: boolean) {
    if (targetVal) {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (!hasHardware) {
          Alert.alert('Hardware Unsupported', 'Your device does not support fingerprint or biometric authentication.');
          return;
        }
        if (!isEnrolled) {
          Alert.alert('No Fingerprint Registered', 'Please register a fingerprint or Face ID in your device system settings first.');
          return;
        }

        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Confirm fingerprint to enable App Lock',
          cancelLabel: 'Cancel',
        });

        if (result.success) {
          await AsyncStorage.setItem('BUILDICY_BIOMETRIC_ENABLED', 'true');
          setBiometricEnabled(true);
          Alert.alert('App Lock Enabled 🔒', 'Buildicy Pulse is now secured. You will be prompted to scan your fingerprint whenever opening the app.');
        } else {
          Alert.alert('Authentication Canceled', 'Fingerprint lock was not enabled.');
        }
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to setup fingerprint lock');
      }
    } else {
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Scan fingerprint to disable App Lock',
          cancelLabel: 'Cancel',
        });

        if (result.success) {
          await AsyncStorage.setItem('BUILDICY_BIOMETRIC_ENABLED', 'false');
          setBiometricEnabled(false);
          Alert.alert('App Lock Disabled', 'Fingerprint authentication has been turned off.');
        }
      } catch (err: any) {
        await AsyncStorage.setItem('BUILDICY_BIOMETRIC_ENABLED', 'false');
        setBiometricEnabled(false);
      }
    }
  }

  async function fetchData() {
    console.log('[SUPABASE FETCH] [More] Querying clients, members, projects & transactions...');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        setUserEmail(session.user.email);
      }

      const { data: c } = await supabase.from('clients').select('*').order('company', { ascending: true });
      const { data: m } = await supabase.from('members').select('*').order('name', { ascending: true });
      const { data: t } = await supabase.from('transactions').select('*').order('date', { ascending: false });
      const { data: p } = await supabase.from('projects').select('*').order('name', { ascending: true });

      setClients(c || []);
      setMembers(m || []);
      setTransactions(t || []);
      setProjectsList(p || []);
    } catch (err: any) {
      console.error('[SUPABASE FETCH ERROR] More screen fetch error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      console.log('[NAVIGATION FOCUS] User opened MORE (Minimal Grid) screen');
      fetchData();
    }, [])
  );

  useEffect(() => {
    const unsubscribe = subscribeToRealtimeChanges(() => {
      console.log('[REALTIME UPDATE] Database update received. Refetching More screen...');
      fetchData();
    });
    return () => unsubscribe();
  }, []);

  const onRefresh = useCallback(() => {
    console.log('[BACKGROUND PROCESS] User refreshed More screen');
    setRefreshing(true);
    fetchData();
  }, []);

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to log out of Buildicy Pulse?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await supabase.auth.signOut();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to sign out');
          }
        },
      },
    ]);
  }

  async function handleCheckForUpdates() {
    console.log('[OTA UPDATE] User manually initiated Check for Updates...');
    try {
      if (__DEV__) {
        Alert.alert(
          'Development Mode',
          'OTA updates are enabled on production / preview builds. Build an APK or publish via EAS to test live updates!'
        );
        return;
      }

      Alert.alert('Checking...', 'Searching for latest Buildicy Pulse updates on Expo Cloud...');
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        Alert.alert(
          '⚡ New Update Found!',
          'A new update is available for Buildicy Pulse. Would you like to download and restart now?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Update Now',
              onPress: async () => {
                try {
                  Alert.alert('Downloading...', 'Downloading latest update package...');
                  await Updates.fetchUpdateAsync();
                  Alert.alert('Success!', 'Update downloaded successfully. Restarting app now...', [
                    {
                      text: 'Restart',
                      onPress: async () => {
                        await Updates.reloadAsync();
                      },
                    },
                  ]);
                } catch (err: any) {
                  Alert.alert('Update Failed', err.message || 'Could not download update');
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('Up To Date', 'Buildicy Pulse is running on the latest version! (v1.0.0)');
      }
    } catch (err: any) {
      console.error('[OTA UPDATE ERROR]', err.message || err);
      Alert.alert('Up To Date', 'Buildicy Pulse is running on the latest version!');
    }
  }

  // --- Client CRUD Actions ---
  const openCreateClientModal = () => {
    setEditingClientId(null);
    setClientName('');
    setClientCompany('');
    setClientEmail('');
    setClientPhone('');
    setIsClientFormOpen(true);
    setIsClientModalOpen(true);
  };

  const openEditClientModal = (c: Client) => {
    setEditingClientId(c.id);
    setClientName(c.name);
    setClientCompany(c.company);
    setClientEmail(c.email || '');
    setClientPhone(c.phone || '');
    setIsClientFormOpen(true);
    setIsClientModalOpen(true);
  };

  async function handleSaveClient() {
    if (!clientName || !clientCompany) {
      Alert.alert('Error', 'Please fill in contact name and company');
      return;
    }
    const payload = {
      name: clientName.trim(),
      company: clientCompany.trim(),
      email: clientEmail.trim() || null,
      phone: clientPhone.trim() || null,
    };
    try {
      if (editingClientId) {
        await supabase.from('clients').update(payload).eq('id', editingClientId);
        Alert.alert('Success', 'Client updated!');
      } else {
        await supabase.from('clients').insert(payload);
        Alert.alert('Success', 'Client added!');
      }
      setIsClientFormOpen(false);
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save client');
    }
  }

  async function handleDeleteClient() {
    if (!editingClientId) return;
    Alert.alert('Delete Client', 'Are you sure you want to remove this client company?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('clients').delete().eq('id', editingClientId);
          setIsClientFormOpen(false);
          fetchData();
        },
      },
    ]);
  }

  // --- Member CRUD Actions ---
  const openCreateMemberModal = () => {
    setEditingMemberId(null);
    setMemberName('');
    setMemberRole('');
    setMemberAvatar('👨‍💻');
    setMemberHourlyRate('');
    setIsMemberFormOpen(true);
    setIsMemberModalOpen(true);
  };

  const openEditMemberModal = (m: Member) => {
    setEditingMemberId(m.id);
    setMemberName(m.name);
    setMemberRole(m.role);
    setMemberAvatar(m.avatar || '👨‍💻');
    setMemberHourlyRate(m.hourly_rate ? String(m.hourly_rate) : '');
    setIsMemberFormOpen(true);
    setIsMemberModalOpen(true);
  };

  async function handleSaveMember() {
    if (!memberName || !memberRole) {
      Alert.alert('Error', 'Please enter member name and role');
      return;
    }
    const payload: any = {
      name: memberName.trim(),
      role: memberRole.trim(),
      avatar: memberAvatar || '👨‍💻',
    };
    if (memberHourlyRate) {
      payload.hourly_rate = parseFloat(memberHourlyRate) || 0;
    }
    try {
      if (editingMemberId) {
        await supabase.from('members').update(payload).eq('id', editingMemberId);
        Alert.alert('Success', 'Team member updated!');
      } else {
        await supabase.from('members').insert(payload);
        Alert.alert('Success', 'Team member added!');
      }
      setIsMemberFormOpen(false);
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save member');
    }
  }

  async function handleDeleteMember() {
    if (!editingMemberId) return;
    Alert.alert('Delete Member', 'Are you sure you want to remove this team member?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('members').delete().eq('id', editingMemberId);
          setIsMemberFormOpen(false);
          fetchData();
        },
      },
    ]);
  }

  // --- PDF Export Actions ---
  async function handleGenerateInvoicePdf() {
    if (!invClient || !invAmount) {
      Alert.alert('Error', 'Please select a client and enter amount');
      return;
    }
    setGeneratingPdf(true);
    const success = await generateAndShareInvoice({
      invoiceNumber: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString().split('T')[0],
      clientName: invClient,
      clientCompany: invClient,
      projectName: invProject || 'Software Engineering Services',
      items: [{ description: invDesc || 'Professional Software Services', amount: parseFloat(invAmount) }],
    });
    setGeneratingPdf(false);
    if (success) {
      setIsInvoiceModalOpen(false);
    }
  }

  async function handleGenerateReportPdf() {
    setGeneratingPdf(true);
    const totalRev = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
    const totalExp = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0);

    const categoriesMap: Record<string, number> = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      const cat = t.category || 'Other';
      categoriesMap[cat] = (categoriesMap[cat] || 0) + Number(t.amount || 0);
    });

    const topExpArray = Object.entries(categoriesMap).map(([category, amount]) => ({ category, amount }));

    const success = await generateAndShareReport({
      title: 'FINANCIAL STATEMENT & PROFIT LOSS REPORT',
      startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      totalRevenue: totalRev,
      totalExpenses: totalExp,
      netProfit: totalRev - totalExp,
      transactionsCount: transactions.length,
      clientsCount: clients.length,
      projectsCount: projectsList.length,
      topExpenses: topExpArray,
    });

    setGeneratingPdf(false);
    if (success) {
      setIsReportModalOpen(false);
    }
  }

  // Expense Calculations
  const expenseTxs = transactions.filter(t => t.type === 'expense');
  const totalAllExp = expenseTxs.reduce((s, t) => s + Number(t.amount || 0), 0);
  const expenseCatMap: Record<string, number> = {};
  expenseTxs.forEach(t => {
    const c = t.category || 'Other';
    expenseCatMap[c] = (expenseCatMap[c] || 0) + Number(t.amount || 0);
  });

  const pendingTxs = transactions.filter(t => t.payment_status === 'pending');

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>LOADING CONTROL CENTER...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7C3AED']} tintColor="#7C3AED" />
        }
      >
        {/* Top Header */}
        <View style={styles.header}>
          <BuildicyLogo size="small" showSubtitle={false} />
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>MORE</Text>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* SECTION 1: MANAGEMENT */}
        {/* ========================================================================= */}
        <View style={styles.section}>
          <View style={styles.sectionHeadingRow}>
            <View style={styles.sectionDot} />
            <Text style={styles.sectionHeading}>MANAGEMENT</Text>
          </View>
          <View style={styles.gridRow}>
            {/* Clients */}
            <TouchableOpacity style={styles.gridItem} onPress={() => setIsClientModalOpen(true)} activeOpacity={0.75}>
              <View style={styles.circleIconBadge}>
                <Ionicons name="people" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.gridLabel}>Clients</Text>
            </TouchableOpacity>

            {/* Team */}
            <TouchableOpacity style={styles.gridItem} onPress={() => setIsMemberModalOpen(true)} activeOpacity={0.75}>
              <View style={styles.circleIconBadge}>
                <Ionicons name="person-add" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.gridLabel}>Team</Text>
            </TouchableOpacity>

            {/* Projects */}
            <TouchableOpacity style={styles.gridItem} onPress={() => router.push('/projects')} activeOpacity={0.75}>
              <View style={styles.circleIconBadge}>
                <Ionicons name="briefcase" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.gridLabel}>Projects</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* SECTION 2: FINANCE */}
        {/* ========================================================================= */}
        <View style={styles.section}>
          <View style={styles.sectionHeadingRow}>
            <View style={styles.sectionDot} />
            <Text style={styles.sectionHeading}>FINANCE</Text>
          </View>
          <View style={styles.gridRow}>
            {/* Expenses */}
            <TouchableOpacity style={styles.gridItem} onPress={() => setIsExpenseModalOpen(true)} activeOpacity={0.75}>
              <View style={styles.circleIconBadge}>
                <Ionicons name="pie-chart" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.gridLabel}>Expenses</Text>
            </TouchableOpacity>

            {/* Invoices */}
            <TouchableOpacity style={styles.gridItem} onPress={() => setIsInvoiceModalOpen(true)} activeOpacity={0.75}>
              <View style={styles.circleIconBadge}>
                <Ionicons name="document-text" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.gridLabel}>Invoices</Text>
            </TouchableOpacity>

            {/* Reports */}
            <TouchableOpacity style={styles.gridItem} onPress={() => setIsReportModalOpen(true)} activeOpacity={0.75}>
              <View style={styles.circleIconBadge}>
                <Ionicons name="stats-chart" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.gridLabel}>Reports</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* SECTION 3: PRODUCTIVITY */}
        {/* ========================================================================= */}
        <View style={styles.section}>
          <View style={styles.sectionHeadingRow}>
            <View style={styles.sectionDot} />
            <Text style={styles.sectionHeading}>PRODUCTIVITY</Text>
          </View>
          <View style={styles.gridRow}>
            {/* Reminders */}
            <TouchableOpacity style={styles.gridItem} onPress={() => setIsReminderModalOpen(true)} activeOpacity={0.75}>
              <View style={styles.circleIconBadge}>
                <Ionicons name="notifications" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.gridLabel}>Reminders</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* SECTION 4: ACCOUNT */}
        {/* ========================================================================= */}
        <View style={styles.section}>
          <View style={styles.sectionHeadingRow}>
            <View style={styles.sectionDot} />
            <Text style={styles.sectionHeading}>ACCOUNT</Text>
          </View>
          <View style={styles.gridRow}>
            {/* Settings */}
            <TouchableOpacity style={styles.gridItem} onPress={() => setIsSettingsModalOpen(true)} activeOpacity={0.75}>
              <View style={styles.circleIconBadge}>
                <Ionicons name="settings" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.gridLabel}>Settings</Text>
            </TouchableOpacity>

            {/* Fingerprint / App Lock */}
            <TouchableOpacity style={styles.gridItem} onPress={() => setIsSettingsModalOpen(true)} activeOpacity={0.75}>
              <View style={[styles.circleIconBadge, { backgroundColor: biometricEnabled ? '#7C3AED' : '#4B5563' }]}>
                <Ionicons name="finger-print" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.gridLabel}>{biometricEnabled ? 'Lock ON' : 'App Lock'}</Text>
            </TouchableOpacity>

            {/* Check Updates */}
            <TouchableOpacity style={styles.gridItem} onPress={handleCheckForUpdates} activeOpacity={0.75}>
              <View style={[styles.circleIconBadge, { backgroundColor: '#10B981' }]}>
                <Ionicons name="cloud-download" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.gridLabel}>Updates</Text>
            </TouchableOpacity>

            {/* Sign Out */}
            <TouchableOpacity style={styles.gridItem} onPress={handleSignOut} activeOpacity={0.75}>
              <View style={[styles.circleIconBadge, styles.redCircleIconBadge]}>
                <Ionicons name="log-out" size={24} color="#FFFFFF" />
              </View>
              <Text style={[styles.gridLabel, { color: '#DC2626' }]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* ========================================================================= */}
      {/* MODAL 1: CLIENT DIRECTORY */}
      {/* ========================================================================= */}
      <Modal visible={isClientModalOpen} animationType="slide" onRequestClose={() => setIsClientModalOpen(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="people-outline" size={22} color="#7C3AED" />
              <Text style={styles.modalTitle}>CLIENT DIRECTORY</Text>
            </View>
            <TouchableOpacity onPress={() => setIsClientModalOpen(false)}>
              <Ionicons name="close" size={24} color="#0B0F17" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 16 }}>
            <TouchableOpacity style={styles.modalAddBtn} onPress={openCreateClientModal}>
              <Text style={styles.modalAddBtnText}>+ REGISTER NEW CLIENT COMPANY</Text>
            </TouchableOpacity>

            {isClientFormOpen ? (
              <View style={styles.modalFormCard}>
                <Text style={styles.modalFormTitle}>{editingClientId ? 'EDIT CLIENT' : 'ADD NEW CLIENT'}</Text>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>COMPANY NAME</Text>
                  <TextInput style={styles.formInput} placeholder="e.g. Apex Tech Solutions" placeholderTextColor="#9CA3AF" value={clientCompany} onChangeText={setClientCompany} />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>PRIMARY CONTACT PERSON</Text>
                  <TextInput style={styles.formInput} placeholder="e.g. Rahul Sharma" placeholderTextColor="#9CA3AF" value={clientName} onChangeText={setClientName} />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>EMAIL ADDRESS</Text>
                  <TextInput style={styles.formInput} placeholder="contact@apextech.com" placeholderTextColor="#9CA3AF" value={clientEmail} onChangeText={setClientEmail} autoCapitalize="none" />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>PHONE NUMBER</Text>
                  <TextInput style={styles.formInput} placeholder="+91 98765 43210" placeholderTextColor="#9CA3AF" value={clientPhone} onChangeText={setClientPhone} />
                </View>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  <TouchableOpacity style={[styles.saveBtn, { flex: 1 }]} onPress={handleSaveClient}>
                    <Text style={styles.saveBtnText}>{editingClientId ? 'UPDATE CLIENT' : 'SAVE CLIENT'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => setIsClientFormOpen(false)}>
                    <Text style={styles.secondaryBtnText}>CANCEL</Text>
                  </TouchableOpacity>
                </View>

                {editingClientId && (
                  <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteClient}>
                    <Text style={styles.deleteBtnText}>DELETE CLIENT</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}

            <Text style={[styles.sectionHeading, { marginTop: 16, marginBottom: 12 }]}>REGISTERED CLIENTS ({clients.length})</Text>
            {clients.map(c => {
              const cProjects = projectsList.filter(p => p.client === c.company || p.client === c.name);
              const cTxs = transactions.filter(t => t.client === c.company || t.client === c.name);
              const totalVal = cTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);

              return (
                <View key={c.id} style={styles.directoryCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dirCardTitle}>{c.company}</Text>
                    <Text style={styles.dirCardSub}>Contact: {c.name}</Text>
                    {c.email && <Text style={styles.dirCardMeta}>{c.email}</Text>}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.dirCardValue}>{formatCurrency(totalVal)}</Text>
                    <Text style={styles.dirCardProj}>{cProjects.length} Projects</Text>
                    <TouchableOpacity style={styles.dirEditBtn} onPress={() => openEditClientModal(c)}>
                      <Text style={styles.dirEditBtnText}>EDIT</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: TEAM MEMBERS & PAYOUTS DIRECTORY */}
      {/* ========================================================================= */}
      <Modal visible={isMemberModalOpen} animationType="slide" onRequestClose={() => setIsMemberModalOpen(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="person-add-outline" size={22} color="#7C3AED" />
              <Text style={styles.modalTitle}>TEAM & CONTRACTORS</Text>
            </View>
            <TouchableOpacity onPress={() => setIsMemberModalOpen(false)}>
              <Ionicons name="close" size={24} color="#0B0F17" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 16 }}>
            <TouchableOpacity style={styles.modalAddBtn} onPress={openCreateMemberModal}>
              <Text style={styles.modalAddBtnText}>+ ADD NEW TEAM MEMBER</Text>
            </TouchableOpacity>

            {isMemberFormOpen ? (
              <View style={styles.modalFormCard}>
                <Text style={styles.modalFormTitle}>{editingMemberId ? 'EDIT TEAM MEMBER' : 'ADD NEW MEMBER'}</Text>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>FULL NAME</Text>
                  <TextInput style={styles.formInput} placeholder="e.g. Vikram Verma" placeholderTextColor="#9CA3AF" value={memberName} onChangeText={setMemberName} />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>ROLE / POSITION</Text>
                  <TextInput style={styles.formInput} placeholder="e.g. Senior Frontend Dev" placeholderTextColor="#9CA3AF" value={memberRole} onChangeText={setMemberRole} />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>HOURLY RATE (INR)</Text>
                  <TextInput style={styles.formInput} placeholder="e.g. 1500" placeholderTextColor="#9CA3AF" value={memberHourlyRate} onChangeText={setMemberHourlyRate} keyboardType="numeric" />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>AVATAR EMOJI</Text>
                  <TextInput style={styles.formInput} placeholder="👨‍💻" placeholderTextColor="#9CA3AF" value={memberAvatar} onChangeText={setMemberAvatar} />
                </View>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  <TouchableOpacity style={[styles.saveBtn, { flex: 1 }]} onPress={handleSaveMember}>
                    <Text style={styles.saveBtnText}>{editingMemberId ? 'UPDATE MEMBER' : 'SAVE MEMBER'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => setIsMemberFormOpen(false)}>
                    <Text style={styles.secondaryBtnText}>CANCEL</Text>
                  </TouchableOpacity>
                </View>

                {editingMemberId && (
                  <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteMember}>
                    <Text style={styles.deleteBtnText}>DELETE MEMBER</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}

            <Text style={[styles.sectionHeading, { marginTop: 16, marginBottom: 12 }]}>TEAM ROSTER ({members.length})</Text>
            {members.map(m => {
              const mPayouts = transactions.filter(t => t.member === m.name && t.type === 'expense');
              const totalPayout = mPayouts.reduce((s, t) => s + Number(t.amount || 0), 0);

              return (
                <View key={m.id} style={styles.directoryCard}>
                  <Text style={{ fontSize: 24, marginRight: 10 }}>{m.avatar || '👨‍💻'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dirCardTitle}>{m.name}</Text>
                    <Text style={styles.dirCardSub}>{m.role.toUpperCase()}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.dirCardValue, { color: '#7C3AED' }]}>{formatCurrency(totalPayout)}</Text>
                    <Text style={styles.dirCardProj}>Total Payouts</Text>
                    <TouchableOpacity style={styles.dirEditBtn} onPress={() => openEditMemberModal(m)}>
                      <Text style={styles.dirEditBtnText}>EDIT</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: EXPENSES BREAKDOWN HUB */}
      {/* ========================================================================= */}
      <Modal visible={isExpenseModalOpen} animationType="slide" onRequestClose={() => setIsExpenseModalOpen(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="pie-chart-outline" size={22} color="#7C3AED" />
              <Text style={styles.modalTitle}>EXPENSES BREAKDOWN</Text>
            </View>
            <TouchableOpacity onPress={() => setIsExpenseModalOpen(false)}>
              <Ionicons name="close" size={24} color="#0B0F17" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 16 }}>
            <View style={styles.summaryBannerCard}>
              <Text style={styles.summaryBannerLabel}>TOTAL EXPENSES RECORDED</Text>
              <Text style={styles.summaryBannerValue}>{formatFullCurrency(totalAllExp)}</Text>
            </View>

            <Text style={[styles.sectionHeading, { marginBottom: 12 }]}>EXPENSE DISTRIBUTION BY CATEGORY</Text>

            {Object.entries(expenseCatMap).map(([category, amount]) => {
              const pct = totalAllExp > 0 ? (amount / totalAllExp) * 100 : 0;
              return (
                <View key={category} style={styles.progressCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={styles.progressCatName}>{category}</Text>
                    <Text style={styles.progressCatValue}>{formatCurrency(amount)} ({pct.toFixed(1)}%)</Text>
                  </View>
                  <View style={styles.progressBarTrack}>
                    <View style={[styles.progressBarFill, { width: `${Math.min(pct, 100)}%` }]} />
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 4: INVOICE GENERATOR & PDF EXPORTER */}
      {/* ========================================================================= */}
      <Modal visible={isInvoiceModalOpen} animationType="slide" onRequestClose={() => setIsInvoiceModalOpen(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="document-text-outline" size={22} color="#7C3AED" />
              <Text style={styles.modalTitle}>INVOICE GENERATOR</Text>
            </View>
            <TouchableOpacity onPress={() => setIsInvoiceModalOpen(false)}>
              <Ionicons name="close" size={24} color="#0B0F17" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 16 }}>
            <View style={styles.modalFormCard}>
              <Text style={styles.modalFormTitle}>CREATE & EXPORT CLIENT INVOICE (PDF)</Text>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>SELECT CLIENT COMPANY</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    {clients.map(c => (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.chip, invClient === c.company && styles.activeChip]}
                        onPress={() => setInvClient(c.company)}
                      >
                        <Text style={[styles.chipText, invClient === c.company && styles.activeChipText]}>{c.company}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>PROJECT NAME (OPTIONAL)</Text>
                <TextInput style={styles.formInput} placeholder="e.g. Mobile Application V2" placeholderTextColor="#9CA3AF" value={invProject} onChangeText={setInvProject} />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>SERVICE DESCRIPTION</Text>
                <TextInput style={styles.formInput} placeholder="e.g. UI Design & API Integration" placeholderTextColor="#9CA3AF" value={invDesc} onChangeText={setInvDesc} />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>TOTAL AMOUNT (INR)</Text>
                <TextInput style={styles.formInput} placeholder="₹ 50000" placeholderTextColor="#9CA3AF" value={invAmount} onChangeText={setInvAmount} keyboardType="numeric" />
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleGenerateInvoicePdf} disabled={generatingPdf}>
                {generatingPdf ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>📄 GENERATE & EXPORT PDF INVOICE</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 5: FINANCIAL REPORTS HUB */}
      {/* ========================================================================= */}
      <Modal visible={isReportModalOpen} animationType="slide" onRequestClose={() => setIsReportModalOpen(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="stats-chart-outline" size={22} color="#7C3AED" />
              <Text style={styles.modalTitle}>FINANCIAL STATEMENTS</Text>
            </View>
            <TouchableOpacity onPress={() => setIsReportModalOpen(false)}>
              <Ionicons name="close" size={24} color="#0B0F17" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 16 }}>
            <View style={styles.modalFormCard}>
              <Text style={styles.modalFormTitle}>GENERATE PROFIT & LOSS STATEMENT (PDF)</Text>
              <Text style={{ fontSize: 11, color: '#64748B', lineHeight: 16, marginBottom: 12 }}>
                Export an official Profit & Loss statement containing live totals for Revenue, Expenses, Net Profit Margin, and Expense Category distributions.
              </Text>

              <TouchableOpacity style={styles.saveBtn} onPress={handleGenerateReportPdf} disabled={generatingPdf}>
                {generatingPdf ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>📊 EXPORT P&L REPORT PDF</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 6: REMINDERS HUB */}
      {/* ========================================================================= */}
      <Modal visible={isReminderModalOpen} animationType="slide" onRequestClose={() => setIsReminderModalOpen(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="notifications-outline" size={22} color="#7C3AED" />
              <Text style={styles.modalTitle}>PAYMENT REMINDERS</Text>
            </View>
            <TouchableOpacity onPress={() => setIsReminderModalOpen(false)}>
              <Ionicons name="close" size={24} color="#0B0F17" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 16 }}>
            <Text style={[styles.sectionHeading, { marginBottom: 12 }]}>PENDING PAYMENTS & ACTION ITEMS ({pendingTxs.length})</Text>

            {pendingTxs.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="checkmark-circle-outline" size={36} color="#059669" />
                <Text style={styles.emptyTitle}>ALL PAYMENTS COMPLETED</Text>
                <Text style={styles.emptySub}>No pending payment confirmations or uncollected invoices.</Text>
              </View>
            ) : (
              pendingTxs.map(t => (
                <View key={t.id} style={styles.directoryCard}>
                  <Ionicons name="alert-circle-outline" size={22} color="#D97706" style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dirCardTitle}>{t.description}</Text>
                    <Text style={styles.dirCardSub}>{t.category} • {t.date}</Text>
                  </View>
                  <Text style={[styles.dirCardValue, { color: '#D97706' }]}>{formatCurrency(t.amount)}</Text>
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 7: APP SETTINGS */}
      {/* ========================================================================= */}
      <Modal visible={isSettingsModalOpen} animationType="slide" onRequestClose={() => setIsSettingsModalOpen(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="settings-outline" size={22} color="#7C3AED" />
              <Text style={styles.modalTitle}>APP & ACCOUNT SETTINGS</Text>
            </View>
            <TouchableOpacity onPress={() => setIsSettingsModalOpen(false)}>
              <Ionicons name="close" size={24} color="#0B0F17" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 16 }}>
            <View style={styles.modalFormCard}>
              <Text style={styles.modalFormTitle}>ACTIVE USER SESSION</Text>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#7C3AED' }}>{userEmail}</Text>
              <Text style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>Connected to Supabase PostgreSQL Database</Text>
            </View>

            <View style={styles.modalFormCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="finger-print" size={18} color="#7C3AED" />
                    <Text style={styles.modalFormTitle}>FINGERPRINT & BIOMETRIC LOCK</Text>
                  </View>
                  <Text style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>
                    Require fingerprint / Face ID scan every time Buildicy Pulse is opened.
                  </Text>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleToggleBiometric}
                  trackColor={{ false: '#374151', true: '#7C3AED' }}
                  thumbColor={biometricEnabled ? '#A855F7' : '#9CA3AF'}
                />
              </View>
            </View>

            <View style={styles.modalFormCard}>
              <Text style={styles.modalFormTitle}>DISPLAY CURRENCY FORMAT</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {['₹', '$', '€'].map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, currencySymbol === c && styles.activeChip]}
                    onPress={() => setCurrencySymbol(c)}
                  >
                    <Text style={[styles.chipText, currencySymbol === c && styles.activeChipText]}>{c} ({c === '₹' ? 'INR' : c === '$' ? 'USD' : 'EUR'})</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F7FC' },
  loadingText: { marginTop: 12, fontSize: 10, fontWeight: '900', color: '#0B0F17', letterSpacing: 2 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerBadge: {
    borderWidth: 1.5,
    borderColor: '#7C3AED',
    backgroundColor: '#0B0F17',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  headerBadgeText: { fontSize: 8, fontWeight: '900', color: '#A855F7', letterSpacing: 1.5 },

  // Sections & Category Headings (Matching Reference Image Layout)
  section: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#7C3AED',
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '900',
    color: '#7C3AED',
    letterSpacing: 1.5,
  },

  // Minimal Grid Row with Glowing Royal Purple Badges
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 20,
  },
  gridItem: {
    width: GRID_ITEM_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  circleIconBadge: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#7C3AED', // Vivid Royal Purple
    borderWidth: 2,
    borderColor: '#C084FC', // Glowing Purple Accent Ring
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  redCircleIconBadge: {
    backgroundColor: '#DC2626', // Crimson Red
    borderColor: '#FCA5A5',
    shadowColor: '#DC2626',
  },
  gridLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0B0F17',
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  // Modal Common Styles
  modalSafe: { flex: 1, backgroundColor: '#F8F7FC' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 16 : 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 2,
    borderBottomColor: '#0B0F17',
  },
  modalTitle: { fontSize: 14, fontWeight: '900', color: '#0B0F17', letterSpacing: 1 },

  modalAddBtn: {
    backgroundColor: '#7C3AED',
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#0B0F17',
    marginBottom: 12,
  },
  modalAddBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 1 },

  modalFormCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#0B0F17',
    borderRadius: 14,
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  modalFormTitle: { fontSize: 12, fontWeight: '900', color: '#7C3AED', letterSpacing: 1 },
  formGroup: { gap: 4 },
  formLabel: { fontSize: 9, fontWeight: '900', color: '#7C3AED', letterSpacing: 1 },
  formInput: {
    height: 44,
    backgroundColor: '#F8F7FC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#0B0F17',
    fontSize: 12,
    fontWeight: '700',
  },

  saveBtn: {
    height: 46,
    backgroundColor: '#7C3AED',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0B0F17',
    marginTop: 4,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  secondaryBtn: {
    height: 46,
    paddingHorizontal: 16,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    marginTop: 4,
  },
  secondaryBtnText: { color: '#475569', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  deleteBtn: {
    height: 40,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#DC2626',
    marginTop: 4,
  },
  deleteBtnText: { color: '#DC2626', fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  directoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#0B0F17',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  dirCardTitle: { fontSize: 14, fontWeight: '900', color: '#0B0F17' },
  dirCardSub: { fontSize: 10, color: '#64748B', fontWeight: '700' },
  dirCardMeta: { fontSize: 9, color: '#94A3B8' },
  dirCardValue: { fontSize: 15, fontWeight: '900', color: '#059669' },
  dirCardProj: { fontSize: 9, fontWeight: '800', color: '#64748B' },
  dirEditBtn: { marginTop: 4, backgroundColor: '#F3E8FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  dirEditBtnText: { fontSize: 8, fontWeight: '900', color: '#7C3AED' },

  summaryBannerCard: {
    backgroundColor: '#0B0F17',
    borderWidth: 2,
    borderColor: '#7C3AED',
    padding: 20,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryBannerLabel: { fontSize: 9, fontWeight: '900', color: '#A855F7', letterSpacing: 2 },
  summaryBannerValue: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', marginTop: 4 },

  progressCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#0B0F17',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  progressCatName: { fontSize: 12, fontWeight: '900', color: '#0B0F17' },
  progressCatValue: { fontSize: 11, fontWeight: '900', color: '#7C3AED' },
  progressBarTrack: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#7C3AED' },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#0B0F17',
    padding: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyTitle: { fontSize: 12, fontWeight: '900', color: '#0B0F17', letterSpacing: 1 },
  emptySub: { fontSize: 10, color: '#64748B', textAlign: 'center' },

  chip: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F8F7FC', borderWidth: 1.5, borderColor: '#CBD5E1', borderRadius: 8 },
  activeChip: { backgroundColor: '#7C3AED', borderColor: '#0B0F17' },
  chipText: { fontSize: 10, fontWeight: '800', color: '#64748B' },
  activeChipText: { color: '#FFFFFF' },
});
